import jsonld from "jsonld";
import ethers from "ethers";
import N3 from "n3";
import { v4 as uuidv4 } from "uuid";
import { MerkleTree } from "merkletreejs";
import {
  DEFAULT_CANON_ALGORITHM,
  DEFAULT_RDF_FORMAT,
  PRIVATE_ASSERTION_PREDICATE,
} from "./constants.js";
import arraifyKeccak256 from "./utils.js";

export async function formatDataset(
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
  } else if (!("public" in json)) {
    json = { public: json };
  }
  const publicCanonizedJson = await jsonld.canonize(json.public, options);
  const publicAssertion = publicCanonizedJson
    .split("\n")
    .filter((x) => x !== "");

  if (publicAssertion?.length === 0 && privateAssertion?.length === 0) {
    throw Error("File format is corrupted, no n-quads are extracted.");
  }
  const dataset = { public: publicAssertion };
  if (privateAssertion) {
    dataset.private = privateAssertion;
  }

  return dataset;
}

export function calculateByteSize(string) {
  if (typeof string !== "string") {
    throw Error(`Size can only be calculated for the 'string' objects.`);
  }

  const encoder = new TextEncoder();
  const encodedBytes = encoder.encode(string);
  return encodedBytes.length;
}

export function calculateNumberOfChunks(quads, chunkSizeBytes = 32) {
  const encoder = new TextEncoder();
  const concatenatedQuads = quads.join("\n");
  const totalSizeBytes = encoder.encode(concatenatedQuads).length;
  return Math.ceil(totalSizeBytes / chunkSizeBytes);
}

export function splitIntoChunks(quads, chunkSizeBytes = 32) {
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

export function calculateMerkleRoot(quads, chunkSizeBytes = 32) {
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

export function calculateMerkleProof(quads, chunkSizeBytes, challenge) {
  const chunks = splitIntoChunks(quads, chunkSizeBytes);
  const leaves = chunks.map((chunk, index) =>
    Buffer.from(
      ethers.utils
        .solidityKeccak256(["string", "uint256"], [chunk, index])
        .replace("0x", ""),
      "hex"
    )
  );

  const tree = new MerkleTree(leaves, arraifyKeccak256, { sortPairs: true });

  return {
    leaf: arraifyKeccak256(chunks[challenge]),
    proof: tree.getHexProof(leaves[challenge]),
  };
}

export function groupNquadsBySubject(nquadsArray, sort = false) {
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

export function countDistinctSubjects(nquadsArray) {
  const parser = new N3.Parser({ format: "star" });
  const subjects = new Set();

  parser
    .parse(nquadsArray.join(""))
    .forEach((quad) => subjects.add(quad.subject.value));

  return subjects.size;
}

export function filterTriplesByAnnotation(
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

export function generateMissingIdsForBlankNodes(nquadsArray) {
  const parser = new N3.Parser({ format: "star" });
  const writer = new N3.Writer({ format: "star" });
  const generatedIds = {};

  // Function to replace blank nodes in quads and nested RDF-star triples
  function replaceBlankNode(term) {
    if (term.termType === "BlankNode") {
      if (!generatedIds[term.value]) {
        generatedIds[term.value] = `uuid:${uuidv4()}`;
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
