const assertionMetadata = require('./assertion-metadata.js');
const calculateRoot = require('./calculate-root.js');
const formatAssertion = require('./assertion-formatting.js');
const formatGraph = require('./graph-formatting.js');
const getMerkleProof = require('./get-merkle-proof.js');
const peerId2Hash = require('./peer-id-2-hash.js');
const keccak256 = require('./keccak256.js');

module.exports = { calculateRoot, formatAssertion, formatGraph, getMerkleProof, peerId2Hash, keccak256, assertionMetadata };
