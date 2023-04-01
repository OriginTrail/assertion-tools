const ethers = require("ethers");
const keccak256 = require("./keccak256.js")
const { MerkleTree } = require("merkletreejs");

module.exports = getMerkleProof = (nquadsArray, challenge) => {
  nquadsArray.sort();

  const leaves = nquadsArray.map((element, index) =>
    keccak256(
      ethers.solidityPacked(
        ["bytes32", "uint256"],
        [keccak256(element), index],
      )
    )
  );
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });

  return {
    leaf: keccak256(nquadsArray[challenge]),
    proof: tree.getHexProof(leaves[challenge]),
  };
};
