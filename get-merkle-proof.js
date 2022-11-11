const keccak256 = require("keccak256");
const web3 = require("web3");
const { MerkleTree } = require("merkletreejs");

module.exports = getMerkleProof = (nquadsArray, challenge) => {
  nquadsArray.sort();

  const leaves = nquadsArray.map((element, index) =>
    keccak256(web3.utils.encodePacked(keccak256(element), index))
  );
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });

  return {
    leaf: keccak256[nquadsArray(challenge)],
    proof: tree.getHexProof(leaves[challenge]),
  };
};
