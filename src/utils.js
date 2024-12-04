import ethers from 'ethers';

export default function arraifyKeccak256(data) {
  let bytesLikeData = data;
  if (!ethers.utils.isBytesLike(data)) {
    bytesLikeData = ethers.utils.toUtf8Bytes(data);
  }
  return ethers.utils.keccak256(bytesLikeData);
};
