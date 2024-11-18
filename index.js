const {
  assertionMetadata,
  calculateRoot,
  formatAssertion,
  formatGraph,
  getMerkleProof,
  peerId2Hash,
  keccak256
} = require('./knowledge-asset-tools.js');

module.exports = { calculateRoot, formatAssertion, formatGraph, getMerkleProof, peerId2Hash, keccak256, assertionMetadata };
