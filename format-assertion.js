const jsonld = require("jsonld");

const ALGORITHM = "URDNA2015";
const FORMAT = "application/n-quads";

module.exports = formatAssertion = async (json, inputFormat) => {
  const options = {
    algorithm: ALGORITHM,
    format: FORMAT,
  };

  if (inputFormat) {
    options.inputFormat = inputFormat;
  }
  const canonizedJson = await jsonld.canonize(json, options);

  const assertion = canonizedJson.split("\n").filter((x) => x !== "");

  if (assertion && assertion.length === 0) {
    throw Error("File format is corrupted, no n-quads are extracted.");
  }

  return assertion;
};
