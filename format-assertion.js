const jsonld = require("jsonld");

module.exports = formatAssertion = async (json) => {
  const canonizedJson = await jsonld.canonize(json, {
    algorithm: "URDNA2015",
    format: "application/n-quads",
  });

  const assertion = canonizedJson.split("\n").filter((x) => x !== "");

  if (assertion && assertion.length === 0) {
    throw Error("File format is corrupted, no n-quads are extracted.");
  }

  return assertion;
};
