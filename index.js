#!/usr/bin/env node
const { program, option } = require('commander');
const { ApiPromise, WsProvider } = require('@polkadot/api');
const { u128 } = require('@polkadot/types');
const edgewareDefinitions = require('@edgeware/node-types');
const { promisify } = require('util');
const uuidv4 = require('uuid/v4');
const fs = require('fs');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

const edgTypes = Object
  .values(edgewareDefinitions)
  .reduce((res, { types }) => ({ ...res, ...types }), {});

const mainnetTypes = {
  ...edgTypes,
  // aliases that don't do well as part of interfaces
  'voting::VoteType': 'VoteType',
  'voting::TallyType': 'TallyType',
  'voting::Tally': 'VotingTally',
  // chain-specific overrides
  Address: 'GenericAddress',
  Keys: 'SessionKeys4',
  StakingLedger: 'StakingLedgerTo223',
  Votes: 'VotesTo230',
  ReferendumInfo: 'ReferendumInfoTo239',
  Weight: 'u32'
};

const beresheetTypes = {
  ...edgTypes,
  // aliases that don't do well as part of interfaces
  'voting::VoteType': 'VoteType',
  'voting::TallyType': 'TallyType',
  'voting::Tally': 'VotingTally',
};

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
  const api = await ApiPromise.create({ provider: new WsProvider(nodeUrl), types });
  console.log('Connected');
  connected = true;

  //
  // get relevant chain data
  //
  const [block, pendingExtrinsics, health] = await Promise.all([
    api.rpc.chain.getBlock(),
    api.rpc.author.pendingExtrinsics(),
    api.rpc.system.health(),
  ]);
  const nPeers = health.peers.toNumber();
  // const bestBlock = +block.block.header.number;
  // if we have no peers we should restart
  if (nPeers === 0) {
    process.exit(1)
  }
  console.log(nPeers);
  // TODO: fix  broken peer request
  // const nPeersAhead = peers.toArray()
  //       .map((p) => +p.bestNumber > bestBlock + 10)
  //       .filter((ahead) => ahead === true)
  //       .length;

  //
  // try to read the last blocknum from a temporary file
  //
  // if it hasn't changed since the last run, and we are behind the
  // majority of peer nodes, we may be stalled and should exit with an
  // error
  //
  // TODO: fix broken peer request
  // console.log(`${bestBlock} is our best block`);
  // if (nPeersAhead > nPeers / 2) {
  //   const storage = await readFileAsync('/tmp/nodeup.lastblock');
  //   const lastBlocknum = parseInt(storage.toString());
  //   if (lastBlocknum === bestBlock) {
  //     console.log(`${nPeersAhead} of ${nPeers} peers are ahead of us`);
  //     console.log('throwing an error since the best block has not updated recently');
  //       process.exit(1);
  //   }
  //   await writeFileAsync('/tmp/nodeup.lastblock', bestBlock);
  // }
  process.exit(0);
};

program
  .name('nodeup')
  .option('-m, --mainnet', 'mainnet config')
  .option('-b, --beresheet', 'beresheet config')
  .option('-u, --url <url>', 'Url of node to connect to')
  .parse(process.argv);

const programOptions = program.opts();
let url = 'wss://mainnet2.edgewa.re';
if (programOptions.url) {
  url = programOptions.url;
}

if (programOptions.beresheet) {
  console.log(`Checking beresheet node at ${url}`);
  checkNode(url, beresheetTypes);
} else {
  console.log(`Checking mainnet node at ${url}`);
  checkNode(url, mainnetTypes);
}
