// Quick script to get error selector for CertificateAlreadyExists
const { keccak256, toUtf8Bytes } = require('ethers');

const errorSignature = 'CertificateAlreadyExists()';
const selector = keccak256(toUtf8Bytes(errorSignature)).substring(0, 10);

console.log('Error Signature:', errorSignature);
console.log('Error Selector:', selector);

