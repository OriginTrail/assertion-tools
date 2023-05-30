function getAssertionSizeInBytes(assertion) {
  return Buffer.byteLength(JSON.stringify(assertion));
}

function getAssertionTriplesNumber(assertion) {
  return assertion.length;
}

function getAssertionChunksNumber(assertion) {
  return assertion.length;
}

module.exports = {
  getAssertionSizeInBytes,
  getAssertionTriplesNumber,
  getAssertionChunksNumber,
};
