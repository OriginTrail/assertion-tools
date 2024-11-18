const jsonld = require('jsonld');
const ethers = require('ethers');
const { MerkleTree } = require('merkletreejs');
const { keccak256 } = require('./utils');

const PRIVATE_ASSERTION_PREDICATE = 'https://ontology.origintrail.io/dkg/1.0#privateAssertionID';
const ALGORITHM = 'URDNA2015';
const FORMAT = 'application/n-quads';

async function formatAssertion(json, inputFormat) {
  const options = {
    algorithm: ALGORITHM,
    format: FORMAT,
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

function getAssertionSizeInBytes(assertion) {
  const jsonString = JSON.stringify(assertion);
  const encoder = new TextEncoder();
  const encodedBytes = encoder.encode(jsonString);
  return encodedBytes.length;
}

function getAssertionTriplesNumber(assertion) {
  return assertion.length;
}

function getAssertionChunksNumber(assertion) {
  return assertion.length;
}

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

function getMerkleProof(nquadsArray, challenge) {
  nquadsArray.sort();

  const leaves = nquadsArray.map((element, index) =>
    keccak256(
      ethers.utils.solidityPack(
        ['bytes32', 'uint256'],
        [keccak256(element), index]
      )
    )
  );
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });

  return {
    leaf: keccak256(nquadsArray[challenge]),
    proof: tree.getHexProof(leaves[challenge]),
  };
}

function isEmptyObject(obj) {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

async function formatGraph(content) {
  let privateAssertion;
  if (content.private && !isEmptyObject(content.private)) {
      privateAssertion = await formatAssertion(content.private);
  }
  const publicGraph = {
      '@graph': [
          content.public && !isEmptyObject(content.public)
              ? content.public
              : null,
          content.private && !isEmptyObject(content.private)
              ? {
                  [PRIVATE_ASSERTION_PREDICATE]: privateAssertion 
                  ? calculateRoot(privateAssertion) : null,
              }
              : null,
      ],
  };
  const publicAssertion = await formatAssertion(publicGraph);

  const result = {
      public: publicAssertion,
  };
  
  if (privateAssertion) {
      result.private = privateAssertion;
  }
  
  return result;
}

async function peerId2Hash(peerId) {
  return ethers.utils.sha256(ethers.utils.toUtf8Bytes(peerId));
}


module.exports = {
  formatAssertion,
  getAssertionSizeInBytes,
  getAssertionTriplesNumber,
  getAssertionChunksNumber,
  calculateRoot,
  getMerkleProof,
  formatGraph,
  peerId2Hash,
};
