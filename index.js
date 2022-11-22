const calculateRoot = require("./calculate-root.js");
const formatAssertion = require("./format-assertion.js");
const peerId2Hash = require("./peer-id-2-hash.js");
const getMerkleProof = require("./get-merkle-proof.js");
const keccak256 = require("./keccak256.js");

module.exports = { calculateRoot, formatAssertion, peerId2Hash, getMerkleProof, keccak256 };
