const keccak256 = require("./keccak256.js");
const ethers = require("ethers");
const { MerkleTree } = require("merkletreejs");

module.exports = calculateRoot = (assertion) => {
  assertion.sort();
  const leaves = assertion.map((element, index) =>
    keccak256(ethers.solidityPacked(["bytes32", "uint256"], [keccak256(element), index]))
  );
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  return `0x${tree.getRoot().toString("hex")}`;
};
