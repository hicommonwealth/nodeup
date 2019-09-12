## nodeup

A simple script for detecting stalled nodes using the polkadot-js API.

Can also be extended to check for other chain parameters.

**This requires an open WebSockets API bound to localhost:9944.
But the API doesn't have to be open to the world, only to
connections from the host machine.**

### Setup

```
apt install -y nodejs npm
npm install -g yarn
yarn
node index.js
```
