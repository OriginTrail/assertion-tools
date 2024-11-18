const { soliditySha256, sha256 } = require('ethers/lib/utils');
const { MerkleTree } = require('merkletreejs');

async function getMerkleProof(nquadsArray, challenge, options = {}) {
  const {
    yieldControlChunkSize = 100,
  } = options;

  nquadsArray.sort();

  const leaves = nquadsArray.map((element, index) =>
    soliditySha256(['string', 'uint256'], [element, index])
  );

  for (let i = 0; i < leaves.length; i += 1) {
    if (i % yieldControlChunkSize === 0) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {setImmediate(resolve)});
    }
  }

  const tree = new MerkleTree(leaves, sha256, { sortPairs: true });

  await new Promise((resolve) => {setImmediate(resolve)});

  const leaf = sha256(nquadsArray[challenge]);
  const proof = tree.getHexProof(leaves[challenge]);

  return { leaf, proof };
}

module.exports = getMerkleProof;