import formatAssertion from './assertion-formatting.js';
import calculateRoot from './calculate-root.js';
import PRIVATE_ASSERTION_PREDICATE from './constants.js';

function isEmptyObject(obj) {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
}

async function formatGraph(content) {
    let privateAssertion;
    if (content.private && !isEmptyObject(content.private)) {
        privateAssertion = await formatAssertion(content.private);
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

export default formatGraph;
