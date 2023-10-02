import jsonld from 'jsonld';
import calculateRoot from './calculate-root.js';
import PRIVATE_ASSERTION_PREDICATE from './constants.js';

const ALGORITHM = 'URDNA2015';
const FORMAT = 'application/n-quads';

function isEmptyObject(obj) {
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

async function normalizeDataset(json, inputFormat) {
  const options = {
    algorithm: ALGORITHM,
    format: FORMAT,
  };

  if (inputFormat) {
    options.inputFormat = inputFormat;
  }

  const canonizedJson = await jsonld.canonize(json, options);
  const assertion = canonizedJson.split('\n').filter((x) => x !== '');

  if (assertion && assertion.length === 0) {
    throw Error('File format is corrupted, no n-quads are extracted.');
  }

  return assertion;
}

async function formatGraph(content) {
  let privateAssertion;
  if (content.private && !isEmptyObject(content.private)) {
      privateAssertion = await normalizeDataset(content.private);
  }
  const publicGraph = {
      '@graph': [
          content.public && !isEmptyObject(content.public)
              ? content.public
              : null,
          content.private && !isEmptyObject(content.private)
              ? {
                  [PRIVATE_ASSERTION_PREDICATE]: privateAssertion 
                  ? calculateRoot(privateAssertion) : null,
              }
              : null,
      ],
  };
  const publicAssertion = await normalizeDataset(publicGraph);

  const result = {
      public: publicAssertion,
  };
  
  if (privateAssertion) {
      result.private = privateAssertion;
  }
  
  return result;
}

export default {
  normalizeDataset,
  formatGraph,
}
