const ethers = require('ethers');
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('./keccak256.js');

function calculateRoot(assertion) {
  assertion.sort();
  const leaves = assertion.map((element, index) =>
    keccak256(
      ethers.utils.solidityPack(
        ['bytes32', 'uint256'],
        [keccak256(element), index]
      )
    )
  );
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  return `0x${tree.getRoot().toString('hex')}`;
}

module.exports = calculateRoot;
