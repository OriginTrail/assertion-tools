const jsonld = require("jsonld");

module.exports = formatAssertion = async (json) => {
  const compactedJson = await jsonld.compact(json, {
    "@context": "http://schema.org/",
  });

  const canonizedJson = await jsonld.canonize(compactedJson, {
    algorithm: "URDNA2015",
    format: "application/n-quads",
  });

  const assertion = canonizedJson.split("\n").filter((x) => x !== "");

  if (assertion && assertion.length === 0) {
    reject("File format is corrupted, no n-quads are extracted.");
  }

  return assertion;
};
