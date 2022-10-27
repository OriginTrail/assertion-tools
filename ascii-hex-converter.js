module.exports = convertASCIIToHex = (asciiString) => {
    let hexString = '';
    let tempASCII, tempHex;
    asciiString.split('').map( char => {
        tempASCII = char.charCodeAt(0)
        tempHex = tempASCII.toString(16);
        hexString += tempHex;
    });

    return hexString;
}

module.exports = convertHexToASCII = (hexString) => {
    let asciiString = '';
    let tempAsciiCode;
    hexString.match(/.{1,2}/g).map( (char_code) => {
        tempAsciiCode = parseInt(char_code, 16);
        asciiString += String.fromCharCode(tempAsciiCode);
    });

    return asciiString;
}
