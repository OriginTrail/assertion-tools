import { describe, it } from 'mocha';
import { expect } from 'chai';
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
} from '../src/knowledge-collection-tools.js';

describe('formatDataset', () => {
  it('should format simple JSON-LD into N-Quads', async () => {
    const jsonld = {
      "@context": { "ex": "http://example.org/" },
      "@id": "ex:subject",
      "ex:predicate": { "@id": "ex:object" },
    };
    const result = await formatDataset(jsonld);
    expect(result).to.deep.equal([
      '<http://example.org/subject> <http://example.org/predicate> <http://example.org/object> .'
    ]);
  });
});

describe('calculateByteSize', () => {
    it('should return the byte size of a simple string', () => {
      expect(calculateByteSize('test string')).to.equal(11);
    });
  
    it('should throw an error for non-string input', () => {
      expect(() => calculateByteSize(123)).to.throw(
        'Size can only be calculated for the \'string\' objects.'
      );
    });
});

describe('calculateNumberOfChunks', () => {
    it('should calculate the correct number of chunks for small data', () => {
      const quads = ['<http://example.org/s> <http://example.org/p> <http://example.org/o> .'];
      expect(calculateNumberOfChunks(quads, 32)).to.equal(3);
    });
  
    it('should calculate the correct number of chunks for large data', () => {
      const quads = [
        '<http://example.org/s1> <http://example.org/p> <http://example.org/o> .',
        '<http://example.org/s2> <http://example.org/p> <http://example.org/o> .'
      ];
      expect(calculateNumberOfChunks(quads, 32)).to.equal(5);
    });
});

describe('splitIntoChunks', () => {
    it('should split data into chunks of the specified size', () => {
      const quads = [
        '<http://example.org/s1> <http://example.org/p> <http://example.org/o> .',
        '<http://example.org/s2> <http://example.org/p> <http://example.org/o> .'
      ];
      const chunks = splitIntoChunks(quads, 32);
      expect(chunks).to.deep.equal([
        '<http://example.org/s1> <http://',
        'example.org/p> <http://example.o',
        'rg/o> .\n<http://example.org/s2> ',
        '<http://example.org/p> <http://e',
        'xample.org/o> .',
      ]);
    });
});

describe('calculateMerkleRoot', () => {
    it('should calculate a valid Merkle root', () => {
      const quads = [
        '<http://example.org/s1> <http://example.org/p> <http://example.org/o> .',
        '<http://example.org/s2> <http://example.org/p> <http://example.org/o> .'
      ];
      const root = calculateMerkleRoot(quads, 32);
      expect(root).to.match(/^0x[0-9a-f]+$/);
    });
});

describe('calculateMerkleProof', () => {
    it('should calculate a valid proof for a given challenge', () => {
      const quads = [
        '<http://example.org/s1> <http://example.org/p> <http://example.org/o> .',
        '<http://example.org/s2> <http://example.org/p> <http://example.org/o> .'
      ];
      const proof = calculateMerkleProof(quads, 32, 1);
      expect(proof).to.have.property('leaf');
      expect(proof).to.have.property('proof');
      expect(proof.proof).to.be.an('array');
    });
});

describe('groupNquadsBySubject', () => {
    it('should group quads by a single subject', () => {
      const quads = [
        '<http://example.org/s1> <http://example.org/p> <http://example.org/o> .',
        '<http://example.org/s1> <http://example.org/p> "Literal" .'
      ];
      const grouped = groupNquadsBySubject(quads);
      expect(grouped).to.have.lengthOf(1);
      expect(grouped[0]).to.deep.include(
        '<http://example.org/s1> <http://example.org/p> <http://example.org/o> .'
      );
      expect(grouped[0]).to.deep.include(
        '<http://example.org/s1> <http://example.org/p> "Literal" .'
      );
    });
  
    it('should group quads by multiple subjects', () => {
      const quads = [
        '<http://example.org/s1> <http://example.org/p1> <http://example.org/o1> .',
        '<http://example.org/s1> <http://example.org/p2> <http://example.org/o2> .',
        '<http://example.org/s2> <http://example.org/p1> <http://example.org/o1> .',
        '<http://example.org/s2> <http://example.org/p2> "Literal" .'
      ];
      const grouped = groupNquadsBySubject(quads);
      expect(grouped).to.have.lengthOf(2);
  
      const group1 = grouped.find((g) => g.some((q) => q.startsWith('<http://example.org/s1>')));
      const group2 = grouped.find((g) => g.some((q) => q.startsWith('<http://example.org/s2>')));
  
      expect(group1).to.deep.include('<http://example.org/s1> <http://example.org/p1> <http://example.org/o1> .');
      expect(group1).to.deep.include('<http://example.org/s1> <http://example.org/p2> <http://example.org/o2> .');
  
      expect(group2).to.deep.include('<http://example.org/s2> <http://example.org/p1> <http://example.org/o1> .');
      expect(group2).to.deep.include('<http://example.org/s2> <http://example.org/p2> "Literal" .');
    });
  
    it('should handle nested RDF-star triples correctly', () => {
      const quads = [
        '<< <http://example.org/s1> <http://example.org/p1> <http://example.org/o1> >> <http://example.org/p2> <http://example.org/o2> .',
        '<< <http://example.org/s1> <http://example.org/p1> <http://example.org/o1> >> <http://example.org/p3> "Annotation" .',
        '<http://example.org/s2> <http://example.org/p4> <http://example.org/o3> .',
        '<http://example.org/s2> <http://example.org/p5> "Literal" .'
      ];
      const grouped = groupNquadsBySubject(quads);
  
      // Expect two groups: one for nested subject, one for normal subject
      expect(grouped).to.have.lengthOf(2);
  
      // Group for nested RDF-star subject
      const nestedGroup = grouped.find((g) => g.some((q) => q.startsWith('<<')));
      expect(nestedGroup).to.deep.include(
        '<<<http://example.org/s1> <http://example.org/p1> <http://example.org/o1>>> <http://example.org/p2> <http://example.org/o2> .'
      );
      expect(nestedGroup).to.deep.include(
        '<<<http://example.org/s1> <http://example.org/p1> <http://example.org/o1>>> <http://example.org/p3> "Annotation" .'
      );
  
      // Group for non-nested subject
      const normalGroup = grouped.find((g) => g.some((q) => q.startsWith('<http://example.org/s2>')));
      expect(normalGroup).to.deep.include('<http://example.org/s2> <http://example.org/p4> <http://example.org/o3> .');
      expect(normalGroup).to.deep.include('<http://example.org/s2> <http://example.org/p5> "Literal" .');
    });
});

describe('countDistinctSubjects', () => {
    it('should count distinct subjects in a simple set of quads', () => {
      const quads = [
        '<http://example.org/s1> <http://example.org/p> <http://example.org/o> .',
        '<http://example.org/s2> <http://example.org/p> <http://example.org/o> .',
        '<http://example.org/s1> <http://example.org/p> "Literal" .'
      ];
      expect(countDistinctSubjects(quads)).to.equal(2); // s1 and s2
    });
  
    it('should handle multiple distinct subjects', () => {
      const quads = [
        '<http://example.org/s1> <http://example.org/p1> <http://example.org/o1> .',
        '<http://example.org/s2> <http://example.org/p2> <http://example.org/o2> .',
        '<http://example.org/s3> <http://example.org/p3> <http://example.org/o3> .',
        '<http://example.org/s4> <http://example.org/p4> "Literal value" .',
        '<http://example.org/s1> <http://example.org/p5> <http://example.org/o5> .'
      ];
      expect(countDistinctSubjects(quads)).to.equal(4); // s1, s2, s3, s4
    });
  
    it('should count nested RDF-star subjects as distinct', () => {
      const quads = [
        '<< <http://example.org/s1> <http://example.org/p1> <http://example.org/o1> >> <http://example.org/p2> <http://example.org/o2> .',
        '<< <http://example.org/s3> <http://example.org/p3> <http://example.org/o3> >> <http://example.org/p4> <http://example.org/o4> .',
        '<http://example.org/s2> <http://example.org/p5> "Literal value" .',
        '<http://example.org/s1> <http://example.org/p6> <http://example.org/o6> .'
      ];
      expect(countDistinctSubjects(quads)).to.equal(3); // s2, nested1, nested2
    });
  
    it('should count blank nodes as distinct subjects', () => {
      const quads = [
        '_:b1 <http://example.org/p1> <http://example.org/o1> .',
        '_:b2 <http://example.org/p2> <http://example.org/o2> .',
        '_:b1 <http://example.org/p3> "Literal value" .',
        '<http://example.org/s1> <http://example.org/p4> <http://example.org/o4> .'
      ];
      expect(countDistinctSubjects(quads)).to.equal(3); // _:b1, _:b2, s1
    });
  
    it('should handle a mix of blank nodes, IRIs, and nested RDF-star subjects', () => {
      const quads = [
        '_:b1 <http://example.org/p1> <http://example.org/o1> .',
        '<http://example.org/s1> <http://example.org/p2> _:b1 .',
        '<http://example.org/s2> <http://example.org/p3> <http://example.org/o3> .',
        '<< <http://example.org/s1> <http://example.org/p4> <http://example.org/o4> >> <http://example.org/p5> <http://example.org/o5> .'
      ];
      expect(countDistinctSubjects(quads)).to.equal(4); // _:b1, s1, s2, nested1
    });
});
  
describe('generateMissingIdsForBlankNodes', () => {
    it('should replace blank nodes in nested RDF-star triples', () => {
        const nquadsArray = [
        '_:b1 <http://example.org/annotates> _:b2 .',
        '_:b2 <http://example.org/predicate> <http://example.org/object> .'
        ];
    
        const updatedQuads = generateMissingIdsForBlankNodes(nquadsArray);
    
        const blankNodeIds = updatedQuads
        .map((quad) => quad.match(/<uuid:[0-9a-f-]+>/g))
        .flat()
        .filter(Boolean);
    
        // Two distinct UUIDs for the two blank nodes
        expect(new Set(blankNodeIds).size).to.equal(2);
        expect(updatedQuads.some((quad) => quad.includes(blankNodeIds[0]))).to.equal(true);
        expect(updatedQuads.some((quad) => quad.includes(blankNodeIds[1]))).to.equal(true);
    });
    
    it('should preserve non-blank node subjects', () => {
        const nquadsArray = [
        '<http://example.org/subject> <http://example.org/predicate> _:b1 .'
        ];
    
        const updatedQuads = generateMissingIdsForBlankNodes(nquadsArray);
    
        expect(updatedQuads[0]).to.match(
        /^<http:\/\/example.org\/subject> <http:\/\/example.org\/predicate> <uuid:[0-9a-f-]+> \.$/
        );
    });
    
    it('should handle a mix of blank nodes and IRIs', () => {
        const nquadsArray = [
        '_:b1 <http://example.org/predicate> _:b2 .',
        '<http://example.org/subject> <http://example.org/predicate> _:b1 .'
        ];
    
        const updatedQuads = generateMissingIdsForBlankNodes(nquadsArray);
    
        const blankNodeIds = updatedQuads
        .map((quad) => quad.match(/<uuid:[0-9a-f-]+>/g))
        .flat()
        .filter(Boolean);
    
        // Two distinct UUIDs for the two blank nodes
        expect(new Set(blankNodeIds).size).to.equal(2);
        expect(updatedQuads.some((quad) => quad.includes('<http://example.org/subject>'))).to.equal(true);
    });
    
    it('should replace deeply nested blank nodes in RDF-star triples with UUIDs', () => {
        const nquadsArray = [
        '_:b1 <http://example.org/annotates> << _:b2 <http://example.org/predicate> _:b3 >> .',
        '_:b2 <http://example.org/predicate> <http://example.org/object> .',
        '_:b3 <http://example.org/predicate> "Nested literal" .'
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
        expect(updatedQuads.some((quad) => quad.includes(blankNodeIds[0]))).to.equal(true);
        expect(updatedQuads.some((quad) => quad.includes(blankNodeIds[1]))).to.equal(true);
        expect(updatedQuads.some((quad) => quad.includes(blankNodeIds[2]))).to.equal(true);
    
        // Verify nested RDF-star structure remains intact
        const nestedQuad = updatedQuads.find((quad) => quad.includes('<<'));
        expect(nestedQuad).to.match(
        new RegExp(`<<${blankNodeIds[1]} <http://example.org/predicate> ${blankNodeIds[2]}>>`)
        );
    });
});
