import ethers from 'ethers';

function keccak256(data) {
  let bytesLikeData = data;
  if (!ethers.utils.isBytesLike(data)) {
    bytesLikeData = ethers.utils.toUtf8Bytes(data);
  }
  return ethers.utils.keccak256(bytesLikeData);
};

export default keccak256;
