import { describe, it } from "mocha";
import { expect } from "chai";
import {
  formatAssertion,
  getAssertionSizeInBytes,
  getAssertionTriplesNumber,
  getAssertionChunksNumber,
  calculateRoot,
  getMerkleProof,
  formatGraph,
} from "../src/knowledge-asset-tools.js";

describe("formatAssertion", () => {
  it("should format simple JSON-LD into N-Quads", async () => {
    const jsonld = {
      "@context": { ex: "http://example.org/" },
      "@id": "ex:subject",
      "ex:predicate": { "@id": "ex:object" },
    };
    const result = await formatAssertion(jsonld);
    expect(result).to.deep.equal([
      "<http://example.org/subject> <http://example.org/predicate> <http://example.org/object> .",
    ]);
  });
});

describe("getAssertionSizeInBytes", () => {
  it("should return the byte size of an assertion", () => {
    const assertion = [
      "<http://example.org/subject> <http://example.org/predicate> <http://example.org/object> .",
    ];
    const size = getAssertionSizeInBytes(assertion);
    expect(size).to.be.a("number");
    expect(size).to.be.greaterThan(0);
  });
});

describe("getAssertionTriplesNumber", () => {
  it("should return the number of triples in an assertion", () => {
    const assertion = [
      "<http://example.org/subject> <http://example.org/predicate> <http://example.org/object> .",
      "<http://example.org/subject2> <http://example.org/predicate2> <http://example.org/object2> .",
    ];
    const numTriples = getAssertionTriplesNumber(assertion);
    expect(numTriples).to.equal(2);
  });
});

describe("getAssertionChunksNumber", () => {
  it("should return the number of chunks in an assertion", () => {
    const assertion = [
      "<http://example.org/subject> <http://example.org/predicate> <http://example.org/object> .",
      "<http://example.org/subject2> <http://example.org/predicate2> <http://example.org/object2> .",
    ];
    const numChunks = getAssertionChunksNumber(assertion);
    expect(numChunks).to.equal(2);
  });
});

describe("calculateRoot", () => {
  it("should calculate a valid Merkle root for the assertion", async () => {
    const assertion = [
      "<http://example.org/subject> <http://example.org/predicate> <http://example.org/object> .",
      "<http://example.org/subject2> <http://example.org/predicate2> <http://example.org/object2> .",
    ];
    const root = await calculateRoot(assertion);
    expect(root).to.match(/^0x[0-9a-f]+$/);
  });
});

describe("getMerkleProof", () => {
  it("should return a valid Merkle proof for a given challenge index", () => {
    const nquadsArray = [
      "<http://example.org/subject> <http://example.org/predicate> <http://example.org/object> .",
      "<http://example.org/subject2> <http://example.org/predicate2> <http://example.org/object2> .",
    ];
    const challenge = 1;
    const proof = getMerkleProof(nquadsArray, challenge);
    expect(proof).to.have.property("leaf");
    expect(proof).to.have.property("proof");
    expect(proof.proof).to.be.an("array");
  });
});

describe("formatGraph", () => {
  it("should format content with public data only", async () => {
    const content = {
      public: {
        "@context": { ex: "http://example.org/" },
        "@id": "ex:subject",
        "ex:predicate": { "@id": "ex:object" },
      },
    };

    const result = await formatGraph(content);

    expect(result).to.have.property("public");
    expect(result.public).to.deep.equal([
      "<http://example.org/subject> <http://example.org/predicate> <http://example.org/object> .",
    ]);
    expect(result).to.not.have.property("private");
  });

  it("should format content with private data only", async () => {
    const content = {
      private: {
        "@context": { ex: "http://example.org/" },
        "@id": "ex:privateSubject",
        "ex:privatePredicate": { "@id": "ex:privateObject" },
      },
    };

    const result = await formatGraph(content);

    expect(result).to.have.property("public");
    expect(result).to.have.property("private");
    expect(result.private).to.deep.equal([
      "<http://example.org/privateSubject> <http://example.org/privatePredicate> <http://example.org/privateObject> .",
    ]);
    expect(result.public[0]).to.include("https://ontology.origintrail.io/dkg/1.0#privateAssertionID");
  });
});
