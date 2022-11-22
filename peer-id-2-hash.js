const ethers = require("ethers");

module.exports = peerId2Hash = async (peerId) => {
  return ethers.utils.sha256(
    ethers.utils.toUtf8Bytes(peerId)
  );
};
