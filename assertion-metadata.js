module.exports = getAssertionSizeInBytes = (assertion) => {
    return Buffer.byteLength(JSON.stringify(assertion));
};

module.exports = getAssertionTriplesNumber = (assertion) => {
    return assertion.length;
};

module.exports = getAssertionChunksNumber = (assertion) => {
    return assertion.length;
};
