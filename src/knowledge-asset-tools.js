import jsonld from "jsonld";
import ethers from "ethers";
import { v4 as uuidv4 } from "uuid";
import { MerkleTree } from "merkletreejs";
import {
  DEFAULT_CANON_ALGORITHM,
  DEFAULT_RDF_FORMAT,
  PRIVATE_ASSERTION_PREDICATE,
} from "./constants.js";
import arraifyKeccak256 from "./utils.js";

export async function formatAssertion(json, inputFormat) {
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

export function getAssertionSizeInBytes(assertion) {
  const jsonString = JSON.stringify(assertion);
  const encoder = new TextEncoder();
  const encodedBytes = encoder.encode(jsonString);
  return encodedBytes.length;
}

export function getAssertionTriplesNumber(assertion) {
  return assertion.length;
}

export function getAssertionChunksNumber(assertion) {
  return assertion.length;
}

export async function calculateRoot(assertion) {
  assertion.sort();
  const leaves = assertion.map((element, index) =>
    arraifyKeccak256(
      ethers.utils.solidityPack(
        ["bytes32", "uint256"],
        [arraifyKeccak256(element), index]
      )
    )
  );
  const tree = new MerkleTree(leaves, arraifyKeccak256, { sortPairs: true });
  return `0x${tree.getRoot().toString("hex")}`;
}

export function getMerkleProof(nquadsArray, challenge) {
  nquadsArray.sort();

  const leaves = nquadsArray.map((element, index) =>
    arraifyKeccak256(
      ethers.utils.solidityPack(
        ["bytes32", "uint256"],
        [arraifyKeccak256(element), index]
      )
    )
  );
  const tree = new MerkleTree(leaves, arraifyKeccak256, { sortPairs: true });

  return {
    leaf: arraifyKeccak256(nquadsArray[challenge]),
    proof: tree.getHexProof(leaves[challenge]),
  };
}

function isEmptyObject(obj) {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

export async function formatGraph(content) {
  let privateAssertion;
  if (content.private && !isEmptyObject(content.private)) {
    privateAssertion = await formatAssertion(content.private);
  }
  const publicGraph = {
    "@graph": [
      content.public && !isEmptyObject(content.public) ? content.public : null,
      content.private && !isEmptyObject(content.private)
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

export function generateNamedNode() {
  return `uuid:${uuidv4()}`;
}
