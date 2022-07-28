const assert = require('assert');
const {formatAssertion, calculateRoot, encrypt, decrypt} = require("../index.js");
const crypto = require("crypto");

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

    it('symmetric encryption', () => {
        const key = crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);

        const assertion = [
            "_:b0 <http://schema.org/jobTitle> \"Professor\" .",
            "_:b0 <http://schema.org/name> \"Jane Doe\" .",
            "_:b0 <http://schema.org/telephone> \"(425) 123-4567\" ."
        ];

        const encryptedAssertion = assertion.map(x=>encrypt(x, key, iv))
        const originalAssertion = encryptedAssertion.map(x=>decrypt(x, key, iv))

        for (let i = 0; i < assertion.length; i += 1) {
            assert (assertion[i] === originalAssertion[i]);
        }
    });
});