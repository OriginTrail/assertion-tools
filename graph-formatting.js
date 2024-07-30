const formatAssertion = require('./assertion-formatting.js');
const calculateRoot = require('./calculate-root.js');
const PRIVATE_ASSERTION_PREDICATE = require('./constants.js');

function isEmptyObject(obj) {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
}

function hasGraphField(obj) {
    if (typeof obj === 'object' && obj !== null) {
      if ('@graph' in obj) {
        return true;
      }
      for (let key in obj) {
        if (hasGraphField(obj[key])) {
          return true;
        }
      }
    }
    return false;
  }

async function formatGraph(content) {
    let privateAssertion;

    if (content.private && !isEmptyObject(content.private)) {
        privateAssertion = await formatAssertion(content.private);
    }

    if(hasGraphField(content)) {
        throw Error('File contains "@graph" field in content is no supported.');
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
    const publicAssertion = await formatAssertion(publicGraph);
  
    const result = {
        public: publicAssertion,
    };
    
    if (privateAssertion) {
        result.private = privateAssertion;
    }
    
    return result;
  }

module.exports = formatGraph;
