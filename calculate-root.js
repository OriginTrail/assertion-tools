const { soliditySha256, sha256 } = require('ethers/lib/utils.js');

async function calculateRoot(assertion, options = { }) {
  const {
    yieldControlChunkSize = 100,
  } = options;

  let leaves = assertion.map((element, index) =>
    Buffer.from(
      soliditySha256(['string', 'uint256'], [element, index]).replace('0x', ''),
      'hex'
    )
  );

  while (leaves.length > 1) {
    const nextLevel = [];

    for (let i = 0; i < leaves.length; i += 2) {
      if (i % yieldControlChunkSize === 0) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {setImmediate(resolve)});
      }

      const left = leaves[i];

      if (i + 1 >= leaves.length) {
        nextLevel.push(left);
        break;
      }
      const right = leaves[i + 1];

      const combined = [left, right];
      combined.sort(Buffer.compare);

      const hash = Buffer.from(
        sha256(Buffer.concat(combined)).replace('0x', ''),
        'hex'
      );

      nextLevel.push(hash);
    }

    leaves = nextLevel;
  }

  return `0x${leaves[0].toString('hex')}`;
}

module.exports = calculateRoot;