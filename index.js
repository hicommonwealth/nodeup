#!/usr/bin/env node
const { program, option } = require('commander');
const { ApiPromise, WsProvider } = require('@polkadot/api');
const { u128 } = require('@polkadot/types');
const { spec } = require('@edgeware/node-types');
const { promisify } = require('util');
const uuidv4 = require('uuid/v4');
const fs = require('fs');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const checkNode = async (nodeUrl, types) => {
  //
  // try to initialize on first run
  //
  try {
    await readFileAsync('/tmp/nodeup.lastblock');
  } catch (e) {
    console.log('Initializing...');
    await writeFileAsync('/tmp/nodeup.lastblock', (0).toString());
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
    ...spec,
  });
  console.log('Connected');
  connected = true;

  //
  // get relevant chain data
  //
  const [block, health, peers] = await Promise.all([
    api.rpc.chain.getBlock(),
    api.rpc.system.health(),
    api.rpc.system.peers(),
  ]);
  const nPeers = health.peers.toNumber();
  const bestBlock = +block.block.header.number;
  // if we have no peers we should restart
  if (nPeers === 0) {
    process.exit(1)
  }
  console.log(`${nPeers} peers connected`);

  // Calculate the number of peers more then 10 blocks ahead
  const nPeersAhead = peers.toArray()
         .map((p) => +p.bestNumber > bestBlock + 10)
         .filter((ahead) => ahead === true)
         .length;

  //
  // if it hasn't changed since the last run, and we are behind the
  // majority of peer nodes, we may be stalled and should exit with an
  // error
  //
  console.log(`${bestBlock} is our best block`);
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

program
  .name('nodeup')
  .option('-u, --url <url>', 'Url of node to connect to')
  .parse(process.argv);

const programOptions = program.opts();
let url = 'wss://mainnet2.edgewa.re';
if (programOptions.url) {
  url = programOptions.url;
}

console.log(`Checking node at ${url}`);
checkNode(url);

