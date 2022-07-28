const jsonld = require('jsonld');
const keccak256 = require('keccak256')
const web3 = require('web3')
const {MerkleTree} = require('merkletreejs')
const {sha256} = require('multiformats/hashes/sha2');
const crypto = require("crypto");

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
    return `0x${tree.getRoot().toString('hex')}`;
}

async function peerId2Hash(peerId) {
    return `0x${Buffer.from((await sha256.digest(peerId.toBytes())).digest).toString('hex')}`;
}

function encrypt(data, key, iv) {
    let cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
}

function decrypt(encrypted, key, iv) {
    let decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    return (decrypted + decipher.final('utf8'));
}

module.exports = {
    formatAssertion,
    calculateRoot,
    peerId2Hash,
    encrypt,
    decrypt
}