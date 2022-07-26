const assert = require('assert');
const {formatAssertion, calculateRoot} = require("../index.js");

let assertion;

describe('Simple tools test', () => {
    it('formatAssertion', async () => {
        const example = {
            "@context": "https://json-ld.org/contexts/person.jsonld",
            "@id": "http://dbpedia.org/resource/John_Lennon",
            "name": "John Lennon",
            "born": "1940-10-09",
            "spouse": "http://dbpedia.org/resource/Cynthia_Lennon"
        };

        assertion = await formatAssertion(example);
        assert(assertion && assertion.length !== 0);
    });
    it('calculateRoot', async () => {
        const assertionId = calculateRoot(assertion);
        assert(assertionId);
    });
});