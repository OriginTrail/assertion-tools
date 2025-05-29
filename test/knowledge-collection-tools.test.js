import { describe, it } from "mocha";
import N3 from 'n3';
import { v4 as uuidv4 } from "uuid";
import { expect } from "chai";
import {
  formatDataset,
  calculateByteSize,
  calculateMerkleProof,
  calculateMerkleRoot,
  calculateNumberOfChunks,
  splitIntoChunks,
  groupNquadsBySubject,
  countDistinctSubjects,
  generateMissingIdsForBlankNodes,
} from "../src/knowledge-collection-tools.js";

describe("formatDataset", () => {
  it("should format simple JSON-LD into N-Quads", async () => {
    const jsonld = {
      "@context": { ex: "http://example.org/" },
      "@id": "ex:subject",
      "ex:predicate": { "@id": "ex:object" },
    };
    const result = await formatDataset(jsonld);
    expect(result.public).to.deep.equal([
      "<http://example.org/subject> <http://example.org/predicate> <http://example.org/object> .",
    ]);
  });
});

describe("formatDataset", () => {
  it("should format JSON-LD with both private and public parts into N-Quads", async () => {
    const jsonld = {
      public: {
        "@context": { ex: "http://example.org/" },
        "@id": "ex:subject",
        "ex:predicate": { "@id": "ex:object" },
      },
      private: {
        "@context": { ex: "http://example.org/" },
        "@id": "ex:privateSubject",
        "ex:predicate": { "@id": "ex:privateObject" },
      },
    };
    const result = await formatDataset(jsonld);
    expect(result.public).to.have.length(1);
    expect(result.public[0]).to.equal(
      "<http://example.org/subject> <http://example.org/predicate> <http://example.org/object> ."
    );
    expect(result.private).to.have.length(1);
    expect(result.private[0]).to.equal(
      "<http://example.org/privateSubject> <http://example.org/predicate> <http://example.org/privateObject> ."
    );
    expect(result.private).to.deep.equal([
      "<http://example.org/privateSubject> <http://example.org/predicate> <http://example.org/privateObject> .",
    ]);
  });
});

describe("calculateByteSize", () => {
  it("should return the byte size of a simple string", () => {
    expect(calculateByteSize("test string")).to.equal(11);
  });

  it("should throw an error for non-string input", () => {
    expect(() => calculateByteSize(123)).to.throw(
      "Size can only be calculated for the 'string' objects."
    );
  });
});

describe("calculateNumberOfChunks", () => {
  it("should calculate the correct number of chunks for small data", () => {
    const quads = [
      "<http://example.org/s> <http://example.org/p> <http://example.org/o> .",
    ];
    expect(calculateNumberOfChunks(quads, 32)).to.equal(3);
  });

  it("should calculate the correct number of chunks for large data", () => {
    const quads = [
      "<http://example.org/s1> <http://example.org/p> <http://example.org/o> .",
      "<http://example.org/s2> <http://example.org/p> <http://example.org/o> .",
    ];
    expect(calculateNumberOfChunks(quads, 32)).to.equal(5);
  });
});

describe("splitIntoChunks", () => {
  it("should split data into chunks of the specified size", () => {
    const quads = [
      "<http://example.org/s1> <http://example.org/p> <http://example.org/o> .",
      "<http://example.org/s2> <http://example.org/p> <http://example.org/o> .",
    ];
    const chunks = splitIntoChunks(quads, 32);
    expect(chunks).to.deep.equal([
      "<http://example.org/s1> <http://",
      "example.org/p> <http://example.o",
      "rg/o> .\n<http://example.org/s2> ",
      "<http://example.org/p> <http://e",
      "xample.org/o> .",
    ]);
  });
});

describe("calculateMerkleRoot", () => {
  it("should calculate a valid Merkle root", () => {
    const quads = [
      "<http://example.org/s1> <http://example.org/p> <http://example.org/o> .",
      "<http://example.org/s2> <http://example.org/p> <http://example.org/o> .",
    ];
    const root = calculateMerkleRoot(quads, 32);
    expect(root).to.match(/^0x[0-9a-f]+$/);
  });
});

describe("calculateMerkleProof", () => {
  it("should calculate a valid proof for a given challenge", () => {
    const quads = [
      "<http://example.org/s1> <http://example.org/p> <http://example.org/o> .",
      "<http://example.org/s2> <http://example.org/p> <http://example.org/o> .",
    ];
    const proof = calculateMerkleProof(quads, 32, 1);
    expect(proof).to.have.property("leaf");
    expect(proof).to.have.property("proof");
    expect(proof.proof).to.be.an("array");
  });
});

describe("groupNquadsBySubject", () => {
  it("should group quads where the object is a resource", () => {
    /* JSON-LD
      {
        "@context": "http://schema.org",
        "@id": "http://example.org/book1",
        "type": "Book",
        "author": {
        "@id": "http://example.org/author1"
        }
      }
    */
    const quads = [
      "<http://example.org/book1> <http://schema.org/author> <http://example.org/author1> .",
      "<http://example.org/book1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/Book> .",
    ];

    const grouped = groupNquadsBySubject(quads);
    expect(grouped).to.have.lengthOf(1);
    expect(grouped[0]).to.deep.include(quads[0]);
    expect(grouped[0]).to.deep.include(quads[1]);
  });

  it("should group quads where the object is a literal", () => {
    /* JSON-LD
    {
      "@context": "http://schema.org",
      "@id": "http://example.org/book1",
      "type": "Book",
      "title": "The Great Book"
    }
    */
    const quads = [
        '<http://example.org/book1> <http://schema.org/title> "The Great Book" .',
        '<http://example.org/book1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/Book> .',
    ];

    const grouped = groupNquadsBySubject(quads);
    expect(grouped).to.have.lengthOf(1);
    expect(grouped[0]).to.deep.include(quads[0]);
    expect(grouped[0]).to.deep.include(quads[1]);
  });

  it("should group quads where the object is a literal containing an escape character", () => {
    /* JSON-LD
    {
      "@context": "http://schema.org",
      "@id": "http://example.org/book1",
      "type": "Book",
      "title": "The Great Book \n"
    }
    */
    const quads = [
        // \n is represented as \\n in code
        '<http://example.org/book1> <http://schema.org/title> "The Great Book \\n" .',
        '<http://example.org/book1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/Book> .',
    ];

    const grouped = groupNquadsBySubject(quads);
    expect(grouped).to.have.lengthOf(1);
    expect(grouped[0]).to.deep.include(quads[0]);
    expect(grouped[0]).to.deep.include(quads[1]);
  });

  it("should group quads where the object is a typed literal", () => {
    /* JSON-LD
    {
      "@context": "http://schema.org",
      "@id": "http://example.org/book1",
      "type": "Book",
      "publicationDate": {
        "@value": "2025-05-28",
        "@type": "http://www.w3.org/2001/XMLSchema#date"
      }
    }
    */
    const quads = [
        '<http://example.org/book1> <http://schema.org/publicationDate> "2025-05-28"^^<http://www.w3.org/2001/XMLSchema#date> .',
        '<http://example.org/book1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/Book> .',
    ];

    const grouped = groupNquadsBySubject(quads);
    expect(grouped).to.have.lengthOf(1);
    expect(grouped[0]).to.deep.include(quads[0]);
    expect(grouped[0]).to.deep.include(quads[1]);
  });

  it("should group quads where the object is a typed literal that includes an escape character", () => {
    /* JSON-LD
    {
      "@context": "http://schema.org",
      "@id": "http://example.org/book1",
      "type": "Book",
      "publicationDate": {
        "@value": "2025-05-28 \n",
        "@type": "http://www.w3.org/2001/XMLSchema#date"
      }
    }
    */
    const quads = [
        // \n is represented as \\n in code
        '<http://example.org/book1> <http://schema.org/publicationDate> "2025-05-28 \\n"^^<http://www.w3.org/2001/XMLSchema#date> .',
        '<http://example.org/book1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/Book> .',
    ];

    const grouped = groupNquadsBySubject(quads);
    expect(grouped).to.have.lengthOf(1);
    expect(grouped[0]).to.deep.include(quads[0]);
    expect(grouped[0]).to.deep.include(quads[1]);
  });

  it("should group quads where the object is a literal with language defined", () => {
    /* JSON-LD
    {
      "@context": "http://schema.org",
      "@id": "http://example.org/book1",
      "type": "Book",
      "description": [
        {
        "@value": "A thrilling adventure novel.",
        "@language": "en"
        },
        {
        "@value": "Napeta pustolovska novela.",
        "@language": "sl"
        }
      ]
    }
    */
    const quads = [
        '<http://example.org/book1> <http://schema.org/description> "A thrilling adventure novel."@en .',
        '<http://example.org/book1> <http://schema.org/description> "Napeta pustolovska novela."@sl .',
        '<http://example.org/book1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/Book> .',
    ];

    const grouped = groupNquadsBySubject(quads);
    expect(grouped).to.have.lengthOf(1);
    expect(grouped[0]).to.deep.include(quads[0]);
    expect(grouped[0]).to.deep.include(quads[1]);
    expect(grouped[0]).to.deep.include(quads[2]);
  });

  it("should group quads where the object is a literal with language defined, containing an escape character", () => {
    /* JSON-LD
    {
      "@context": "http://schema.org",
      "@id": "http://example.org/book1",
      "type": "Book",
      "description": [
        {
        "@value": "A thrilling adventure novel. \n",
        "@language": "en"
        },
        {
        "@value": "Napeta pustolovska novela. \n",
        "@language": "sl"
        }
      ]
    }
    */
    const quads = [
        // \n is represented as \\n in code
        '<http://example.org/book1> <http://schema.org/description> "A thrilling adventure novel. \\n"@en .',
        '<http://example.org/book1> <http://schema.org/description> "Napeta pustolovska novela. \\n"@sl .',
        '<http://example.org/book1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/Book> .',
    ];

    const grouped = groupNquadsBySubject(quads);
    expect(grouped).to.have.lengthOf(1);
    expect(grouped[0]).to.deep.include(quads[0]);
    expect(grouped[0]).to.deep.include(quads[1]);
    expect(grouped[0]).to.deep.include(quads[2]);
  });

  it("should group quads where the object is a literal with language defined, while subject is a blank node", () => {
    /* JSON-LD
    {
      "@context": {
        "predicate": "http://example.org/predicate"
      },
      "@graph": [
        {
        "predicate": {
            "@value": "something",
            "@language": "en"
        }
        }
      ]
    }
    */
    const quads = [
        `<${uuidv4()}> <http://example.org/predicate> "something"@en .`,
    ];

    const grouped = groupNquadsBySubject(quads);
    expect(grouped).to.have.lengthOf(1);
    expect(grouped[0]).to.deep.include(quads[0]);
  });

  it("should group quads by multiple subjects", () => {
    const quads = [
      "<http://example.org/s1> <http://example.org/p1> <http://example.org/o1> .",
      "<http://example.org/s1> <http://example.org/p2> <http://example.org/o2> .",
      "<http://example.org/s2> <http://example.org/p1> <http://example.org/o1> .",
      '<http://example.org/s2> <http://example.org/p2> "Literal" .',
    ];
    const grouped = groupNquadsBySubject(quads);
    expect(grouped).to.have.lengthOf(2);

    const group1 = grouped.find((g) =>
      g.some((q) => q.startsWith("<http://example.org/s1>"))
    );
    const group2 = grouped.find((g) =>
      g.some((q) => q.startsWith("<http://example.org/s2>"))
    );

    expect(group1).to.deep.include(
      "<http://example.org/s1> <http://example.org/p1> <http://example.org/o1> ."
    );
    expect(group1).to.deep.include(
      "<http://example.org/s1> <http://example.org/p2> <http://example.org/o2> ."
    );

    expect(group2).to.deep.include(
      "<http://example.org/s2> <http://example.org/p1> <http://example.org/o1> ."
    );
    expect(group2).to.deep.include(
      '<http://example.org/s2> <http://example.org/p2> "Literal" .'
    );
  });

  it("should handle nested RDF-star triples correctly", () => {
    const quads = [
      "<< <http://example.org/s1> <http://example.org/p1> <http://example.org/o1> >> <http://example.org/p2> <http://example.org/o2> .",
      '<< <http://example.org/s1> <http://example.org/p1> <http://example.org/o1> >> <http://example.org/p3> "Annotation" .',
      "<http://example.org/s2> <http://example.org/p4> <http://example.org/o3> .",
      '<http://example.org/s2> <http://example.org/p5> "Literal" .',
    ];
    const grouped = groupNquadsBySubject(quads);

    // Expect two groups: one for nested subject, one for normal subject
    expect(grouped).to.have.lengthOf(2);

    // Group for nested RDF-star subject
    const nestedGroup = grouped.find((g) => g.some((q) => q.startsWith("<<")));
    expect(nestedGroup).to.deep.include(
      "<<<http://example.org/s1> <http://example.org/p1> <http://example.org/o1>>> <http://example.org/p2> <http://example.org/o2> ."
    );
    expect(nestedGroup).to.deep.include(
      '<<<http://example.org/s1> <http://example.org/p1> <http://example.org/o1>>> <http://example.org/p3> "Annotation" .'
    );

    // Group for non-nested subject
    const normalGroup = grouped.find((g) =>
      g.some((q) => q.startsWith("<http://example.org/s2>"))
    );
    expect(normalGroup).to.deep.include(
      "<http://example.org/s2> <http://example.org/p4> <http://example.org/o3> ."
    );
    expect(normalGroup).to.deep.include(
      '<http://example.org/s2> <http://example.org/p5> "Literal" .'
    );
  });
});

describe("countDistinctSubjects", () => {
  it("should count distinct subjects in a simple set of quads", () => {
    const quads = [
      "<http://example.org/s1> <http://example.org/p> <http://example.org/o> .",
      "<http://example.org/s2> <http://example.org/p> <http://example.org/o> .",
      '<http://example.org/s1> <http://example.org/p> "Literal" .',
    ];
    expect(countDistinctSubjects(quads)).to.equal(2); // s1 and s2
  });

  it("should handle multiple distinct subjects", () => {
    const quads = [
      "<http://example.org/s1> <http://example.org/p1> <http://example.org/o1> .",
      "<http://example.org/s2> <http://example.org/p2> <http://example.org/o2> .",
      "<http://example.org/s3> <http://example.org/p3> <http://example.org/o3> .",
      '<http://example.org/s4> <http://example.org/p4> "Literal value" .',
      "<http://example.org/s1> <http://example.org/p5> <http://example.org/o5> .",
    ];
    expect(countDistinctSubjects(quads)).to.equal(4); // s1, s2, s3, s4
  });

  it("should count nested RDF-star subjects as distinct", () => {
    const quads = [
      "<< <http://example.org/s1> <http://example.org/p1> <http://example.org/o1> >> <http://example.org/p2> <http://example.org/o2> .",
      "<< <http://example.org/s3> <http://example.org/p3> <http://example.org/o3> >> <http://example.org/p4> <http://example.org/o4> .",
      '<http://example.org/s2> <http://example.org/p5> "Literal value" .',
      "<http://example.org/s1> <http://example.org/p6> <http://example.org/o6> .",
    ];
    expect(countDistinctSubjects(quads)).to.equal(3); // s2, nested1, nested2
  });

  it("should count blank nodes as distinct subjects", () => {
    const quads = [
      "_:b1 <http://example.org/p1> <http://example.org/o1> .",
      "_:b2 <http://example.org/p2> <http://example.org/o2> .",
      '_:b1 <http://example.org/p3> "Literal value" .',
      "<http://example.org/s1> <http://example.org/p4> <http://example.org/o4> .",
    ];
    expect(countDistinctSubjects(quads)).to.equal(3); // _:b1, _:b2, s1
  });

  it("should handle a mix of blank nodes, IRIs, and nested RDF-star subjects", () => {
    const quads = [
      "_:b1 <http://example.org/p1> <http://example.org/o1> .",
      "<http://example.org/s1> <http://example.org/p2> _:b1 .",
      "<http://example.org/s2> <http://example.org/p3> <http://example.org/o3> .",
      "<< <http://example.org/s1> <http://example.org/p4> <http://example.org/o4> >> <http://example.org/p5> <http://example.org/o5> .",
    ];
    expect(countDistinctSubjects(quads)).to.equal(4); // _:b1, s1, s2, nested1
  });
});

describe("generateMissingIdsForBlankNodes", () => {
  it("should replace blank nodes in nested RDF-star triples", () => {
    const nquadsArray = [
      "_:b1 <http://example.org/annotates> _:b2 .",
      "_:b2 <http://example.org/predicate> <http://example.org/object> .",
    ];

    const updatedQuads = generateMissingIdsForBlankNodes(nquadsArray);

    const blankNodeIds = updatedQuads
      .map((quad) => quad.match(/<uuid:[0-9a-f-]+>/g))
      .flat()
      .filter(Boolean);

    // Two distinct UUIDs for the two blank nodes
    expect(new Set(blankNodeIds).size).to.equal(2);
    expect(
      updatedQuads.some((quad) => quad.includes(blankNodeIds[0]))
    ).to.equal(true);
    expect(
      updatedQuads.some((quad) => quad.includes(blankNodeIds[1]))
    ).to.equal(true);
  });

  it("should preserve non-blank node subjects", () => {
    const nquadsArray = [
      "<http://example.org/subject> <http://example.org/predicate> _:b1 .",
    ];

    const updatedQuads = generateMissingIdsForBlankNodes(nquadsArray);

    expect(updatedQuads[0]).to.match(
      /^<http:\/\/example.org\/subject> <http:\/\/example.org\/predicate> <uuid:[0-9a-f-]+> \.$/
    );
  });

  it("should handle a mix of blank nodes and IRIs", () => {
    const nquadsArray = [
      "_:b1 <http://example.org/predicate> _:b2 .",
      "<http://example.org/subject> <http://example.org/predicate> _:b1 .",
    ];

    const updatedQuads = generateMissingIdsForBlankNodes(nquadsArray);

    const blankNodeIds = updatedQuads
      .map((quad) => quad.match(/<uuid:[0-9a-f-]+>/g))
      .flat()
      .filter(Boolean);

    // Two distinct UUIDs for the two blank nodes
    expect(new Set(blankNodeIds).size).to.equal(2);
    expect(
      updatedQuads.some((quad) => quad.includes("<http://example.org/subject>"))
    ).to.equal(true);
  });

  it("should replace deeply nested blank nodes in RDF-star triples with UUIDs", () => {
    const nquadsArray = [
      "_:b1 <http://example.org/annotates> << _:b2 <http://example.org/predicate> _:b3 >> .",
      "_:b2 <http://example.org/predicate> <http://example.org/object> .",
      '_:b3 <http://example.org/predicate> "Nested literal" .',
    ];

    const updatedQuads = generateMissingIdsForBlankNodes(nquadsArray);

    // Extract UUIDs from updated quads
    const blankNodeIds = updatedQuads
      .map((quad) => quad.match(/<uuid:[0-9a-f-]+>/g))
      .flat()
      .filter(Boolean);

    // Ensure all UUIDs are unique
    expect(new Set(blankNodeIds).size).to.equal(3); // _:b1, _:b2, _:b3

    // Verify that each blank node is replaced and referenced correctly
    expect(
      updatedQuads.some((quad) => quad.includes(blankNodeIds[0]))
    ).to.equal(true);
    expect(
      updatedQuads.some((quad) => quad.includes(blankNodeIds[1]))
    ).to.equal(true);
    expect(
      updatedQuads.some((quad) => quad.includes(blankNodeIds[2]))
    ).to.equal(true);

    // Verify nested RDF-star structure remains intact
    const nestedQuad = updatedQuads.find((quad) => quad.includes("<<"));
    expect(nestedQuad).to.match(
      new RegExp(
        `<<${blankNodeIds[1]} <http://example.org/predicate> ${blankNodeIds[2]}>>`
      )
    );
  });

  it("should replace an object blank node", () => {
    /*
     JSON-LD
    {
      "@context": {
        "relatedTo": "http://example.org/relatedTo"
      },
      "@id": "http://example.org/document/1",
      "relatedTo": {}
    }
     */
    const nquadsArray = [
      "<http://example.org/document/1> <http://example.org/relatedTo> _:c14n0 .",
    ];

    const updatedQuads = generateMissingIdsForBlankNodes(nquadsArray);

    const parser = new N3.Parser();
    const quads = parser.parse(updatedQuads.join('\n'));

    expect(quads[0]._subject.id).equals('http://example.org/document/1');

    expect(quads[0]._predicate.id).equals('http://example.org/relatedTo');

    const uuidRegex = /^uuid:[0-9a-fA-F\-]{36}$/;
    expect(quads[0]._object.id.match(uuidRegex));

    expect(quads[0]._graph.id).equals('');
  });

  it("should replace an occuring object blank node", () => {
    /*
     JSON-LD
    {
      "@context": {
        "is": {"@id": "http://example.org/is"}
      },
      "@graph": [
        {
        "@id": "http://example.org/subject1",
        "is": {"@id": "_:sharedBlank"}
        },
        {
        "@id": "http://example.org/subject2",
        "is": {"@id": "_:sharedBlank"}
        }
      ]
    }
     */
    const nquadsArray = [
      "<http://example.org/subject1> <http://example.org/is> _:c14n0 .",
      "<http://example.org/subject2> <http://example.org/is> _:c14n0 .",
    ];

    const updatedQuads = generateMissingIdsForBlankNodes(nquadsArray);

    const parser = new N3.Parser();
    const quads = parser.parse(updatedQuads.join('\n'));

    expect(quads[0]._subject.id).equals('http://example.org/subject1');
    expect(quads[1]._subject.id).equals('http://example.org/subject2');

    expect(quads[0]._predicate.id).equals('http://example.org/is');
    expect(quads[1]._predicate.id).equals('http://example.org/is');

    const uuidRegex = /^uuid:[0-9a-fA-F\-]{36}$/;

    expect(quads[0]._object.id.match(uuidRegex));
    expect(quads[1]._object.id.match(uuidRegex));

    expect(quads[0]._graph.id).equals('');
    expect(quads[1]._graph.id).equals('');

    expect(quads[0]._object.id).equals(quads[1]._object.id);
  });

  it("should replace a subject blank node", () => {
    /*
     JSON-LD
    {
      "@context": {
        "ex": "http://example.org/"
      },
      "@graph": [
        {
        "ex:name": "John Doe"
        }
      ]
    }
     */
    const nquadsArray = [
      '_:c14n0 <http://example.org/name> "John Doe" .',
    ];

    const updatedQuads = generateMissingIdsForBlankNodes(nquadsArray);

    const parser = new N3.Parser();
    const quads = parser.parse(updatedQuads.join('\n'));

    const uuidRegex = /^uuid:[0-9a-fA-F\-]{36}$/;
    expect(quads[0]._subject.id.match(uuidRegex));

    expect(quads[0]._predicate.id).equals('http://example.org/name');

    expect(quads[0]._object.id).equals('"John Doe"');

    expect(quads[0]._graph.id).equals('');
  });

  it("should replace an occuring subject blank node", () => {
    /*
     JSON-LD
    {
      "@context": {
        "ex": "http://example.org/"
      },
      "@graph": [
        {
        "ex:name": "John Doe",
        "ex:sex": "male"
        }
      ]
    }
     */
    const nquadsArray = [
      '_:c14n0 <http://example.org/name> "John Doe" .',
      '_:c14n0 <http://example.org/sex> "male" .',
    ];

    const updatedQuads = generateMissingIdsForBlankNodes(nquadsArray);

    const parser = new N3.Parser();
    const quads = parser.parse(updatedQuads.join('\n'));

    const uuidRegex = /^uuid:[0-9a-fA-F\-]{36}$/;
    expect(quads[0]._subject.id.match(uuidRegex));
    expect(quads[1]._subject.id.match(uuidRegex));

    expect(quads[0]._predicate.id).equals('http://example.org/name');
    expect(quads[1]._predicate.id).equals('http://example.org/sex');

    expect(quads[0]._object.id).equals('"John Doe"');
    expect(quads[1]._object.id).equals('"male"');

    expect(quads[0]._graph.id).equals('');
    expect(quads[1]._graph.id).equals('');

    expect(quads[0]._subject.id).equals(quads[1]._subject.id);
  });

  it("should not replace two different subject blank node with the same UUID", () => {
    /*
     JSON-LD
    {
      "@context": {
        "ex": "http://example.org/"
      },
      "@graph": [
        {
        "ex:hasName": "Alice",
        "ex:sex": "male"
        },
        {
        "ex:hasName": "Bob",
        "ex:sex": "female"
        }
      ]
    }
     */
    const nquadsArray = [
      '_:c14n0 <http://example.org/sex> "male" .',
      '_:c14n0 <http://example.org/hasName> "Bob" .',
      '_:c14n1 <http://example.org/sex> "female" .',
      '_:c14n1 <http://example.org/hasName> "Alice" .',
    ];

    const updatedQuads = generateMissingIdsForBlankNodes(nquadsArray);

    const parser = new N3.Parser();
    const quads = parser.parse(updatedQuads.join('\n'));

    const uuidRegex = /^uuid:[0-9a-fA-F\-]{36}$/;
    expect(quads[0]._subject.id.match(uuidRegex));
    expect(quads[1]._subject.id.match(uuidRegex));
    expect(quads[2]._subject.id.match(uuidRegex));
    expect(quads[3]._subject.id.match(uuidRegex));

    expect(quads[0]._predicate.id).equals('http://example.org/sex');
    expect(quads[1]._predicate.id).equals('http://example.org/hasName');
    expect(quads[2]._predicate.id).equals('http://example.org/sex');
    expect(quads[3]._predicate.id).equals('http://example.org/hasName');

    expect(quads[0]._object.id).equals('"male"');
    expect(quads[1]._object.id).equals('"Bob"');
    expect(quads[2]._object.id).equals('"female"');
    expect(quads[3]._object.id).equals('"Alice"');

    expect(quads[0]._graph.id).equals('');
    expect(quads[1]._graph.id).equals('');
    expect(quads[2]._graph.id).equals('');
    expect(quads[3]._graph.id).equals('');

    expect(quads[0]._subject.id).equals(quads[1]._subject.id);
    expect(quads[2]._subject.id).equals(quads[3]._subject.id);
    expect(quads[0]._subject.id).not.equals(quads[2]._subject.id);
  });

  it("should replace an object blank node, that occurs as a subject, with the same UUID", () => {
    /*
     JSON-LD
    {
      "@context": "http://schema.org",
      "review": {
        "reviewBody": "Excellent book!"
      }
    }
     */
    const nquadsArray = [
      '_:c14n0 <http://schema.org/reviewBody> "Excellent book!" .',
      "_:c14n1 <http://schema.org/review> _:c14n0 .",
    ];

    const updatedQuads = generateMissingIdsForBlankNodes(nquadsArray);

    const parser = new N3.Parser();
    const quads = parser.parse(updatedQuads.join('\n'));

    const uuidRegex = /^uuid:[0-9a-fA-F\-]{36}$/;
    expect(quads[0]._subject.id.match(uuidRegex));
    expect(quads[1]._subject.id.match(uuidRegex));

    expect(quads[0]._predicate.id).equals('http://schema.org/reviewBody');
    expect(quads[1]._predicate.id).equals('http://schema.org/review');

    expect(quads[0]._object.id).equals('"Excellent book!"');
    expect(quads[1]._object.id.match(uuidRegex));

    expect(quads[0]._graph.id).equals('');
    expect(quads[1]._graph.id).equals('');


    expect(quads[0]._subject.id).not.equals(quads[1]._subject.id);
    expect(quads[0]._subject.id).equals(quads[1]._object.id);
  });

  it("should fail since graphs aren't supported at this stage", () => {
    /*
     JSON-LD
    {
      "@context": {
        "@base": "https://example.org/",
        "name": "http://schema.org/name",
        "knows": {
          "@id": "http://schema.org/knows",
          "@type": "@id"
        },
        "Person": "http://schema.org/Person"
      },
      "@graph": [
        {
          "@type": "Person",
          "name": "Alice",
          "knows": [
            {
              "@id": "_:bob"
            },
            {
              "@id": "_:carol"
            }
          ]
        },
        {
          "@id": "_:bob",
          "@graph": [
            {
              "@type": "Person",
              "name": "Bob"
            }
          ]
        },
        {
          "@id": "_:carol",
          "@graph": [
            {
              "@type": "Person",
              "name": "Carol"
            }
          ]
        }
      ]
    }
     */
    const nquadsArray = [
      '_:c14n2 <http://schema.org/name> "Carol" _:c14n0 .',
      '_:c14n2 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/Person> _:c14n0 .',
      '_:c14n3 <http://schema.org/knows> _:c14n0 .',
      '_:c14n3 <http://schema.org/knows> _:c14n1 .',
      '_:c14n3 <http://schema.org/name> "Alice" .',
      '_:c14n3 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/Person> .',
      '_:c14n4 <http://schema.org/name> "Bob" _:c14n1 .',
      '_:c14n4 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/Person> _:c14n1 .'
    ];

    try {
      generateMissingIdsForBlankNodes(nquadsArray);
    } catch (error) {
      expect(error.message).equals(`
------------------------------------------------------------------------------------------------
Unsupported JSON-LD input detected

After parsing the JSON-LD input, the parser detected creation of new named graphs.
The DKG does not support custom named graphs.

Problematic Quads:
  1. "Carol" <http://schema.org/name> "Carol" _:b31_c14n0 .

  2. <http://schema.org/Person> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/Person> _:b31_c14n0 .

  3. "Bob" <http://schema.org/name> "Bob" _:b31_c14n1 .

  4. <http://schema.org/Person> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/Person> _:b31_c14n1 .


Full Parsed N-Quads Array:
_:c14n2 <http://schema.org/name> "Carol" _:c14n0 .
_:c14n2 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/Person> _:c14n0 .
_:c14n3 <http://schema.org/knows> _:c14n0 .
_:c14n3 <http://schema.org/knows> _:c14n1 .
_:c14n3 <http://schema.org/name> "Alice" .
_:c14n3 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/Person> .
_:c14n4 <http://schema.org/name> "Bob" _:c14n1 .
_:c14n4 <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://schema.org/Person> _:c14n1 .
`);
    }
  });
});
