import { describe, it, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { assertionFormatting, calculateRoot } from '../index.js';

let assertion;

describe('Simple tools test', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('Dataset normalization', async () => {
        const example = {
            '@context': 'https://json-ld.org/contexts/person.jsonld',
            '@id': 'http://dbpedia.org/resource/John_Lennon',
            'name': 'John Lennon',
            'born': '1940-10-09',
            'spouse': 'http://dbpedia.org/resource/Cynthia_Lennon'
        };

        assertion = await assertionFormatting.normalizeDataset(example);

        expect(assertion).to.not.equal(null);
        expect(assertion.length).to.not.equal(0);
    });
    it('Graph formatting', async () => {
        const exampleContent = {
            public: {
                '@context': ['https://schema.org'],
                '@id': 'uuid:1',
                company: 'OT',
                user: {
                    '@id': 'uuid:user:1',
                },
                city: {
                    '@id': 'uuid:belgrade',
                },
            },
            private: {
                '@context': ['https://schema.org'],
                '@graph': [
                    {
                        '@id': 'uuid:user:1',
                        name: 'Adam',
                        lastname: 'Smith',
                    },
                    {
                        '@id': 'uuid:belgrade',
                        title: 'Belgrade',
                        postCode: '11000',
                    },
                ],
            },
        };

        const expectedPublicNQuads = [
            '<uuid:1> <http://schema.org/city> <uuid:belgrade> .',
            '<uuid:1> <http://schema.org/company> "OT" .',
            '<uuid:1> <http://schema.org/user> <uuid:user:1> .',
            '_:c14n0 <https://ontology.origintrail.io/dkg/1.0#privateAssertionID> "0xcfab2d364fe01757d7a83d3b32284395d87b1c379adabb1e28a16666e0a4fca9" .'
        ];
        const expectedPrivateNQuads = [
            '<uuid:belgrade> <http://schema.org/postCode> "11000" .',
            '<uuid:belgrade> <http://schema.org/title> "Belgrade" .',
            '<uuid:user:1> <http://schema.org/lastname> "Smith" .',
            '<uuid:user:1> <http://schema.org/name> "Adam" .'
        ];
        
        const assertions = await assertionFormatting.formatGraph(exampleContent);

        expect(assertions).to.have.property('public').to.deep.equal(expectedPublicNQuads);
        expect(assertions).to.have.property('private').to.deep.equal(expectedPrivateNQuads);
    });
    it('Merkle Root calculation', async () => {
        const assertionId = calculateRoot(assertion);

        expect(assertionId).to.not.equal(null);
    });
});