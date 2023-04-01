const ethers = require("ethers");

module.exports = peerId2Hash = async (peerId) => {
  return ethers.sha256(
    ethers.toUtf8Bytes(peerId)
  );
};
