const keccak256 = require("keccak256");
const web3 = require("web3");
const { MerkleTree } = require("merkletreejs");

module.exports = calculateRoot = (assertion) => {
  assertion.sort();
  const leaves = assertion.map((element, index) =>
    keccak256(web3.utils.encodePacked(keccak256(element), index))
  );
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  return `0x${tree.getRoot().toString("hex")}`;
};
