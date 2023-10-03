const ethers = require('ethers');

async function peerId2Hash(peerId) {
  return ethers.utils.sha256(ethers.utils.toUtf8Bytes(peerId));
}

module.exports = peerId2Hash;
