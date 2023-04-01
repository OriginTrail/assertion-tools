const ethers = require("ethers");

module.exports = keccak256 = (data) => {
    let bytesLikeData = data;
    if (!ethers.isBytesLike(data)) {
        bytesLikeData = ethers.toUtf8Bytes(data);
    }
    return ethers.keccak256(bytesLikeData);
};
