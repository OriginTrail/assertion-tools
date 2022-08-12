const { sha256 } = require("multiformats/hashes/sha2");

module.exports = peerId2Hash = async (peerId) => {
  return `0x${Buffer.from(
    (await sha256.digest(peerId.toBytes())).digest
  ).toString("hex")}`;
};
