'use strict';

var jsonld = require('jsonld');
var ethers = require('ethers');
var uuid = require('uuid');
var merkletreejs = require('merkletreejs');
var N3 = require('n3');

const DEFAULT_CANON_ALGORITHM = 'URDNA2015';

const DEFAULT_RDF_FORMAT = 'application/n-quads';

const PRIVATE_ASSERTION_PREDICATE = 'https://ontology.origintrail.io/dkg/1.0#privateAssertionID';

function arraifyKeccak256(data) {
  let bytesLikeData = data;
  if (!ethers.utils.isBytesLike(data)) {
    bytesLikeData = ethers.utils.toUtf8Bytes(data);
  }
  return ethers.utils.keccak256(bytesLikeData);
}

async function formatAssertion(json, inputFormat) {
  const options = {
    algorithm: DEFAULT_CANON_ALGORITHM,
    format: DEFAULT_RDF_FORMAT,
  };

  if (inputFormat) {
    options.inputFormat = inputFormat;
  }

  const canonizedJson = await jsonld.canonize(json, options);
  const assertion = canonizedJson.split("\n").filter((x) => x !== "");

  if (assertion && assertion.length === 0) {
    throw Error("File format is corrupted, no n-quads are extracted.");
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

async function calculateRoot(assertion) {
  assertion.sort();
  const leaves = assertion.map((element, index) =>
    arraifyKeccak256(
      ethers.utils.solidityPack(
        ["bytes32", "uint256"],
        [arraifyKeccak256(element), index]
      )
    )
  );
  const tree = new merkletreejs.MerkleTree(leaves, arraifyKeccak256, { sortPairs: true });
  return `0x${tree.getRoot().toString("hex")}`;
}

function getMerkleProof(nquadsArray, challenge) {
  nquadsArray.sort();

  const leaves = nquadsArray.map((element, index) =>
    arraifyKeccak256(
      ethers.utils.solidityPack(
        ["bytes32", "uint256"],
        [arraifyKeccak256(element), index]
      )
    )
  );
  const tree = new merkletreejs.MerkleTree(leaves, arraifyKeccak256, { sortPairs: true });

  return {
    leaf: arraifyKeccak256(nquadsArray[challenge]),
    proof: tree.getHexProof(leaves[challenge]),
  };
}

function isEmptyObject$1(obj) {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

async function formatGraph(content) {
  let privateAssertion;
  if (content.private && !isEmptyObject$1(content.private)) {
    privateAssertion = await formatAssertion(content.private);
  }
  const publicGraph = {
    "@graph": [
      content.public && !isEmptyObject$1(content.public) ? content.public : null,
      content.private && !isEmptyObject$1(content.private)
        ? {
            [PRIVATE_ASSERTION_PREDICATE]: privateAssertion
              ? calculateRoot(privateAssertion)
              : null,
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

function generateNamedNode() {
  return `uuid:${uuid.v4()}`;
}

var knowledgeAssetTools = /*#__PURE__*/Object.freeze({
  __proto__: null,
  calculateRoot: calculateRoot,
  formatAssertion: formatAssertion,
  formatGraph: formatGraph,
  generateNamedNode: generateNamedNode,
  getAssertionChunksNumber: getAssertionChunksNumber,
  getAssertionSizeInBytes: getAssertionSizeInBytes,
  getAssertionTriplesNumber: getAssertionTriplesNumber,
  getMerkleProof: getMerkleProof
});

async function formatDataset(
  json,
  inputFormat,
  outputFormat = DEFAULT_RDF_FORMAT,
  algorithm = DEFAULT_CANON_ALGORITHM
) {
  const options = {
    algorithm,
    format: outputFormat,
  };

  if (inputFormat) {
    options.inputFormat = inputFormat;
  }

  let privateAssertion;
  if (json.private && !isEmptyObject(json.private)) {
    const privateCanonizedJson = await jsonld.canonize(json.private, options);
    privateAssertion = privateCanonizedJson.split("\n").filter((x) => x !== "");
  } else if (!json.public) {
    json = { public: json };
  }
  const publicCanonizedJson = await jsonld.canonize(json.public, options);
  const publicAssertion = publicCanonizedJson
    .split("\n")
    .filter((x) => x !== "");

  if (
    publicAssertion &&
    publicAssertion.length === 0 &&
    privateAssertion &&
    privateAssertion?.length === 0
  ) {
    throw Error("File format is corrupted, no n-quads are extracted.");
  }
  const dataset = { public: publicAssertion };
  if (privateAssertion) {
    dataset.private = privateAssertion;
  }

  return dataset;
}

function calculateByteSize(string) {
  if (typeof string !== "string") {
    throw Error(`Size can only be calculated for the 'string' objects.`);
  }

  const encoder = new TextEncoder();
  const encodedBytes = encoder.encode(string);
  return encodedBytes.length;
}

function calculateNumberOfChunks(quads, chunkSizeBytes = 32) {
  const encoder = new TextEncoder();
  const concatenatedQuads = quads.join("\n");
  const totalSizeBytes = encoder.encode(concatenatedQuads).length;
  return Math.ceil(totalSizeBytes / chunkSizeBytes);
}

function splitIntoChunks(quads, chunkSizeBytes = 32) {
  const encoder = new TextEncoder();

  const concatenatedQuads = quads.join("\n");
  const encodedBytes = encoder.encode(concatenatedQuads);

  const chunks = [];
  let start = 0;

  while (start < encodedBytes.length) {
    const end = Math.min(start + chunkSizeBytes, encodedBytes.length);
    const chunk = encodedBytes.slice(start, end);
    chunks.push(Buffer.from(chunk).toString("utf-8"));
    start = end;
  }

  return chunks;
}

function calculateMerkleRoot(quads, chunkSizeBytes = 32) {
  const chunks = splitIntoChunks(quads, chunkSizeBytes);
  let leaves = chunks.map((chunk, index) =>
    Buffer.from(
      ethers.utils
        .solidityKeccak256(["string", "uint256"], [chunk, index])
        .replace("0x", ""),
      "hex"
    )
  );

  while (leaves.length > 1) {
    const nextLevel = [];

    for (let i = 0; i < leaves.length; i += 2) {
      const left = leaves[i];

      if (i + 1 >= leaves.length) {
        nextLevel.push(left);
        break;
      }
      const right = leaves[i + 1];

      const combined = [left, right];
      combined.sort(Buffer.compare);

      const hash = Buffer.from(
        ethers.utils.keccak256(Buffer.concat(combined)).replace("0x", ""),
        "hex"
      );

      nextLevel.push(hash);
    }

    leaves = nextLevel;
  }

  return `0x${leaves[0].toString("hex")}`;
}

function calculateMerkleProof(quads, chunkSizeBytes, challenge) {
  const chunks = splitIntoChunks(quads, chunkSizeBytes);
  const leaves = chunks.map((chunk, index) =>
    Buffer.from(
      ethers.utils
        .solidityKeccak256(["string", "uint256"], [chunk, index])
        .replace("0x", ""),
      "hex"
    )
  );

  const tree = new merkletreejs.MerkleTree(leaves, arraifyKeccak256, { sortPairs: true });

  return {
    leaf: arraifyKeccak256(chunks[challenge]),
    proof: tree.getHexProof(leaves[challenge]),
  };
}

function groupNquadsBySubject(nquadsArray, sort = false) {
  const parser = new N3.Parser({ format: "star" });
  const grouped = {};

  parser.parse(nquadsArray.join("")).forEach((quad) => {
    const { subject, predicate, object } = quad;

    let subjectKey;
    if (subject.termType === "Quad") {
      const nestedSubject = subject.subject.value;
      const nestedPredicate = subject.predicate.value;
      const nestedObject =
        subject.object.termType === "Literal"
          ? `"${subject.object.value}"`
          : `<${subject.object.value}>`;
      subjectKey = `<<<${nestedSubject}> <${nestedPredicate}> ${nestedObject}>>`;
    } else {
      subjectKey = `<${subject.value}>`;
    }

    if (!grouped[subjectKey]) {
      grouped[subjectKey] = [];
    }

    const objectValue =
      object.termType === "Literal" ? `"${object.value}"` : `<${object.value}>`;

    const quadString = `${subjectKey} <${predicate.value}> ${objectValue} .`;
    grouped[subjectKey].push(quadString);
  });

  let groupedValues = Object.entries(grouped);

  if (sort) {
    groupedValues = groupedValues.sort(([keyA], [keyB]) =>
      keyA.localeCompare(keyB)
    );
  }

  return groupedValues.map(([, quads]) => quads);
}

function countDistinctSubjects(nquadsArray) {
  const parser = new N3.Parser({ format: "star" });
  const subjects = new Set();

  parser
    .parse(nquadsArray.join(""))
    .forEach((quad) => subjects.add(quad.subject.value));

  return subjects.size;
}

function filterTriplesByAnnotation(
  nquadsArray,
  annotationPredicate = null,
  annotationValue = null,
  filterNested = true
) {
  const parser = new N3.Parser({ format: "star" });
  const filteredTriples = [];

  parser.parse(nquadsArray.join("")).forEach((quad) => {
    const { subject, predicate, object } = quad;

    const isNested = subject.termType === "Quad";

    if (filterNested && isNested) {
      const nestedSubject = subject.subject.value;
      const nestedPredicate = subject.predicate.value;
      const nestedObject =
        subject.object.termType === "Literal"
          ? `"${subject.object.value}"`
          : `<${subject.object.value}>`;

      const matches =
        (!annotationPredicate || predicate.value === annotationPredicate) &&
        (!annotationValue || object.value === annotationValue);

      if (matches) {
        filteredTriples.push(
          `<${nestedSubject}> <${nestedPredicate}> ${nestedObject}`
        );
      }
    } else if (!filterNested && !isNested) {
      const subjectValue = `<${subject.value}>`;
      const objectValue =
        object.termType === "Literal"
          ? `"${object.value}"`
          : `<${object.value}>`;

      const matches =
        (!annotationPredicate || predicate.value === annotationPredicate) &&
        (!annotationValue || object.value === annotationValue);

      if (matches) {
        filteredTriples.push(
          `${subjectValue} <${predicate.value}> ${objectValue} .`
        );
      }
    }
  });

  return filteredTriples;
}

function generateMissingIdsForBlankNodes(nquadsArray) {
  const parser = new N3.Parser({ format: "star" });
  const writer = new N3.Writer({ format: "star" });
  const generatedIds = {};

  // Function to replace blank nodes in quads and nested RDF-star triples
  function replaceBlankNode(term) {
    if (term.termType === "BlankNode") {
      if (!generatedIds[term.value]) {
        generatedIds[term.value] = `uuid:${uuid.v4()}`;
      }
      return N3.DataFactory.namedNode(generatedIds[term.value]);
    }

    if (term.termType === "Quad") {
      // Recursively handle nested RDF-star triples
      return N3.DataFactory.quad(
        replaceBlankNode(term.subject),
        replaceBlankNode(term.predicate),
        replaceBlankNode(term.object)
      );
    }
    return term; // Return IRI or Literal unchanged
  }

  const updatedNquads = parser.parse(nquadsArray.join("")).map((quad) => {
    // Replace blank nodes in the quad
    const updatedQuad = N3.DataFactory.quad(
      replaceBlankNode(quad.subject),
      replaceBlankNode(quad.predicate),
      replaceBlankNode(quad.object)
    );

    // Convert back to string format
    return updatedQuad;
  });

  return writer.quadsToString(updatedNquads).trimEnd().split("\n");
}

function isEmptyObject(obj) {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

var knowledgeCollectionTools = /*#__PURE__*/Object.freeze({
  __proto__: null,
  calculateByteSize: calculateByteSize,
  calculateMerkleProof: calculateMerkleProof,
  calculateMerkleRoot: calculateMerkleRoot,
  calculateNumberOfChunks: calculateNumberOfChunks,
  countDistinctSubjects: countDistinctSubjects,
  filterTriplesByAnnotation: filterTriplesByAnnotation,
  formatDataset: formatDataset,
  generateMissingIdsForBlankNodes: generateMissingIdsForBlankNodes,
  groupNquadsBySubject: groupNquadsBySubject,
  splitIntoChunks: splitIntoChunks
});

exports.kaTools = knowledgeAssetTools;
exports.kcTools = knowledgeCollectionTools;
