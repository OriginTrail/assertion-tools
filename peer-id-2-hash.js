import ethers from 'ethers';

async function peerId2Hash(peerId) {
  return ethers.utils.sha256(ethers.utils.toUtf8Bytes(peerId));
}

export default peerId2Hash;
