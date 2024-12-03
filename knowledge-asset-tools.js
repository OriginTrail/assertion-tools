const jsonld = require('jsonld');
const ethers = require('ethers');
const { MerkleTree } = require('merkletreejs');
const { keccak256 } = require('./utils');
const { soliditySha256, sha256 } = require('ethers/lib/utils.js');

const PRIVATE_ASSERTION_PREDICATE = 'https://ontology.origintrail.io/dkg/1.0#privateAssertionID';
const ALGORITHM = 'URDNA2015';
const FORMAT = 'application/n-quads';
const N3 = require('n3');
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

const assertionMetadata = {getAssertionSizeInBytes, getAssertionTriplesNumber, getAssertionChunksNumber}

async function calculateRoot(assertion, options = { }) {
  const {
    yieldControlChunkSize = 100,
  } = options;

  let leaves = assertion.map((element, index) =>
    Buffer.from(
      soliditySha256(['string', 'uint256'], [element, index]).replace('0x', ''),
      'hex'
    )
  );

  while (leaves.length > 1) {
    const nextLevel = [];

    for (let i = 0; i < leaves.length; i += 2) {
      if (i % yieldControlChunkSize === 0) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {setImmediate(resolve)});
      }

      const left = leaves[i];

      if (i + 1 >= leaves.length) {
        nextLevel.push(left);
        break;
      }
      const right = leaves[i + 1];

      const combined = [left, right];
      combined.sort(Buffer.compare);

      const hash = Buffer.from(
        sha256(Buffer.concat(combined)).replace('0x', ''),
        'hex'
      );

      nextLevel.push(hash);
    }

    leaves = nextLevel;
  }

  return `0x${leaves[0].toString('hex')}`;
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
  if (isEmptyObject(content)) {
      return {};
  }

  const graph = {
      '@graph': [content],
  }

  return await formatAssertion(graph);
}

async function peerId2Hash(peerId) {
  return ethers.utils.sha256(ethers.utils.toUtf8Bytes(peerId));
}



function groupNquadsBySubject(nquadsArray) {
  const store = new N3.Store();
  const parser = new N3.Parser({ format: 'star' });

  
  nquadsArray.forEach((quad) => {
    try {
      const parsedQuad = parser.parse(quad);
      parsedQuad.forEach(quad => store.addQuad(quad));
    } catch (error) {
      console.error("Error parsing quad:", quad);
      console.error(error);
    }
  });

  
  function groupTriples(triples) {
    const grouped = {};

    triples.forEach((quad) => {
      let subject = quad.subject ? quad.subject : null; 
      const predicate = quad.predicate.value;
      let object = quad.object;

      if (subject && subject.termType === 'Quad') {
        
        const nestedSubjectKey = `<<${subject.subject.value}> <${subject.predicate.value}> ${subject.object.value}>>`;
        
        if (!grouped[nestedSubjectKey]) {
          grouped[nestedSubjectKey] = [];
        }

        grouped[nestedSubjectKey].push([predicate, object.value]);
      } else {
        
        object = object ? object.value : '';

        if (!grouped[subject.value]) {
          grouped[subject.value] = [];
        }

        grouped[subject.value].push([predicate, object]);
      }
    });

    return grouped;
  }

  const allTriples = store.getQuads(null, null, null, null);
  return groupTriples(allTriples);
}

function countDistinctSubjects(nquadsArray) {
  const store = new N3.Store();
  const parser = new N3.Parser({ format: 'star' });

 
  nquadsArray.forEach((quad) => {
    try {
      const parsedQuad = parser.parse(quad);
      parsedQuad.forEach(quad => store.addQuad(quad));
    } catch (error) {
      console.error("Error parsing quad:", quad);
      console.error(error);
    }
  });

  const subjects = new Set();
 
  store.getQuads(null, null, null, null).forEach((quad) => {
    const subject = quad.subject.value;
    subjects.add(subject);  
  });

  return subjects.size;
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
  groupNquadsBySubject,
  countDistinctSubjects,
  assertionMetadata
};
