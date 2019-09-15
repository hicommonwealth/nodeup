#!/usr/bin/env node

const { ApiPromise, WsProvider } = require('@polkadot/api');
const { u128 } = require('@polkadot/types');
const { IdentityTypes } = require('edgeware-node-types/dist/identity');
const { SignalingTypes } = require('edgeware-node-types/dist/signaling');
const { VotingTypes } = require('edgeware-node-types/dist/voting');
const { promisify } = require('util');
const uuidv4 = require('uuid/v4');
const fs = require('fs');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const checkNode = async (nodeUrl) => {
  //
  // try to initialize on first run
  //
  try {
    await readFileAsync('/tmp/nodeup.lastblock');
  } catch (e) {
    console.log('Initializing...');
    await writeFileAsync('/tmp/nodeup.lastblock', 0);
  }

  //
  // set a timeout manually, since ApiPromise won't let us do this
  // if the timeout is reached, kill the process with exitcode 1
  //
  console.log(`Connecting to API for ${nodeUrl}...`);
  let connected;
  setTimeout(() => {
    if (connected) return;
    console.log('Connection timed out');
    process.exit(1);
  }, 2000);

  //
  // initialize the api
  //
  const api = await ApiPromise.create({
    provider: new WsProvider(nodeUrl),
    types: {
      ...IdentityTypes,
      ...SignalingTypes,
      ...VotingTypes,
      Balance2: u128,
    },
  });
  console.log('Connected');
  connected = true;

  //
  // get relevant chain data
  //
  const [peers, block, pendingExtrinsics, health] = await Promise.all([
    api.rpc.system.peers(),
    api.rpc.chain.getBlock(),
    api.rpc.author.pendingExtrinsics(),
    api.rpc.system.health(),
  ]);
  const bestBlock = +block.block.header.number;
  const bestPeerBlock = Math.max.apply(this, peers.toArray().map((p) => +p.bestNumber));
  const nPeers = peers.length;
  const nPeersAhead = peers.toArray()
        .map((p) => +p.bestNumber > bestBlock + 10)
        .filter((ahead) => ahead === true)
        .length;

  //
  // try to read the last blocknum from a temporary file
  //
  // if it hasn't changed since the last run, and we are behind the
  // majority of peer nodes, we may be stalled and should exit with an
  // error
  //
  console.log(`${bestBlock} is our best block, ${bestPeerBlock} is the best peer block`);
  if (nPeersAhead > nPeers / 2) {
    const storage = await readFileAsync('/tmp/nodeup.lastblock');
    const lastBlocknum = parseInt(storage.toString());
    if (lastBlocknum === bestBlock) {
      console.log(`${nPeersAhead} of ${nPeers} peers are ahead of us`);
      console.log('throwing an error since the best block has not updated recently');
        process.exit(1);
    }
    await writeFileAsync('/tmp/nodeup.lastblock', bestBlock);
  }
  process.exit(0);
};

checkNode('ws://localhost:9944');
