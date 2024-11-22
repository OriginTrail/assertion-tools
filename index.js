const {
  assertionMetadata,
  calculateRoot,
  formatAssertion,
  formatGraph,
  getMerkleProof,
  peerId2Hash,
  keccak256
} = require('./knowledge-asset-tools.js');

const {
  calculateNumberOfChunks,
  calculateByteSize,
  flattenDataset,
  formatDataset
} = require('./knowledge-collection-tools.js');

module.exports = { calculateRoot, formatAssertion, formatGraph, getMerkleProof, peerId2Hash, keccak256, assertionMetadata, calculateNumberOfChunks, calculateByteSize, flattenDataset,
  formatDataset };
