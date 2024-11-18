const jsonld = require('jsonld');
const ethers = require('ethers');
const { MerkleTree } = require('merkletreejs');
const { keccak256 } = require('./utils');

async function flattenDataset(dataset) {
  try {
    const flattened = await jsonld.flatten(dataset);
    return flattened;
  } catch (error) {
    console.error('Error processing JSON-LD:', error);
    throw error;
  }
}

async function formatDataset(json, inputFormat, outputFormat='application/n-quads', algorithm='URDNA2015') {
  const options = {
    algorithm,
    format: outputFormat,
  };

  if (inputFormat) {
    options.inputFormat = inputFormat;
  }

  const canonizedJson = await jsonld.canonize(json, options);
  const assertion = canonizedJson.split('\n').filter((x) => x !== '');

  if (assertion && assertion.length === 0) {
    throw Error('File format is corrupted, no n-quads are extracted.');
  }

  return assertion;
}

function calculateByteSize(string) {
  if (typeof string !== 'string') {
    throw Error(`Size can only be calculated for the 'string' objects.`);
  }

  const encoder = new TextEncoder();
  const encodedBytes = encoder.encode(string);
  return encodedBytes.length;
}

function splitNQuad(nQuad, chunkSizeBytes) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8');

  const encodedNQuadBytes = encoder.encode(nQuad);

  const chunks = [];
  let start = 0;

  while (start < encodedNQuadBytes.length) {
    const end = Math.min(start + chunkSizeBytes, encodedNQuadBytes.length);
    const chunk = decoder.decode(encodedNQuadBytes.slice(start, end));
    chunks.push(chunk);
    start = end;
  }

  return chunks;
}

function splitNQuadsIntoChunks(nQuads, chunkSizeBytes) {
  return nQuads.flatMap((nQuad) => splitNQuad(nQuad, chunkSizeBytes));
}

function calculateNumberOfChunks(nQuads, chunkSizeBytes) {
  let numberOfChunks = 0;

  for (const nQuad of nQuads) {
    const nQuadSize = calculateByteSize(nQuad);

    numberOfChunks += Math.floor(nQuadSize / chunkSizeBytes);

    if (nQuadSize % chunkSizeBytes !== 0) {
      numberOfChunks += 1;
    }
  }

  return numberOfChunks;
}

async function splitDataset(dataset, chunkSizeBytes) {
  const chunks = [];
  const entities = await flattenDataset(dataset);

  for (const entity of entities) {
    // eslint-disable-next-line no-await-in-loop
    const entityNQuads = await formatDataset(entity);
    const entityChunks = splitNQuadsIntoChunks(entityNQuads, chunkSizeBytes);
    chunks.push(...entityChunks);
  }

  return chunks;
}

async function calculateMerkleRoot(dataset, chunkSizeBytes) {
  const chunks = await splitDataset(dataset, chunkSizeBytes);
  const leaves = chunks.map((chunk, index) =>
    keccak256(
      ethers.utils.solidityPack(
        ['bytes32', 'uint256'],
        [keccak256(chunk), index]
      )
    )
  );
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  return `0x${tree.getRoot().toString('hex')}`;
}

async function calculateMerkleRoot2(dataset, chunkSizeBytes) {
  const chunks = await splitDataset(dataset, chunkSizeBytes);
  let nodes = chunks.map((chunk, index) =>
    keccak256(
      ethers.utils.solidityPack(
        ['bytes32', 'uint256'],
        [keccak256(chunk), index]
      )
    )
  );

  while (nodes.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < nodes.length; i += 2) {
      const left = Buffer.from(nodes[i].slice(2), 'hex'); // Remove "0x" prefix and convert to Buffer
      const right = Buffer.from(nodes[i + 1]?.slice(2) || nodes[i].slice(2), 'hex'); // Handle odd case
      nextLevel.push(keccak256(Buffer.concat([left, right])));
    }
    nodes = nextLevel; // Move to the next level
  }

  return nodes[0];
}

async function calculateMerkleProof(dataset, chunkSizeBytes, challenge) {
  const chunks = await splitDataset(dataset, chunkSizeBytes)
  const leaves = chunks.map((element, index) =>
    keccak256(
      ethers.utils.solidityPack(
        ['bytes32', 'uint256'],
        [keccak256(element), index]
      )
    )
  );
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });

  return {
    leaf: keccak256(chunks[challenge]),
    proof: tree.getHexProof(leaves[challenge]),
  };
}

module.exports = {
  flattenDataset,
  formatDataset,
  calculateByteSize,
  splitNQuad,
  splitNQuadsIntoChunks,
  splitDataset,
  calculateNumberOfChunks,
  calculateMerkleRoot,
  calculateMerkleRoot2,
  calculateMerkleProof,
};
