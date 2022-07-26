const jsonld = require('jsonld');
const keccak256 = require('keccak256')
const web3 = require('web3')
const {MerkleTree} = require('merkletreejs')

function formatAssertion(json) {
    return new Promise(async (accept, reject) => {
        const compactedJson = await jsonld.compact(json, {
            "@context": "https://schema.org/",
        });

        const canonizedJson = await jsonld.canonize(compactedJson, {
            algorithm: "URDNA2015",
            format: "application/n-quads",
        });

        const assertion = canonizedJson.split('\n').filter((x) => x !== '');

        if (assertion && assertion.length === 0) {
            reject('File format is corrupted, no n-quads are extracted.');
        }

        accept(assertion);
    });
}

function calculateRoot(assertion) {
    assertion.sort();
    const leaves = assertion.map((element, index) => keccak256(web3.utils.encodePacked(
        keccak256(element),
        index
    )))
    const tree = new MerkleTree(leaves, keccak256, {sortPairs: true})
    return tree.getRoot().toString('hex')
}

module.exports = {
    formatAssertion,
    calculateRoot,
}