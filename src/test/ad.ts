// @ts-ignore
const Web3 = require("web3");
// @ts-ignore
const web3 = new Web3();
const tokenAddress = "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7";
const tokenAddress1 = "0xB31f66AA3C1e785363F0875A1B74e27b85Fd66c7";

// if (tokenAddress.startsWith("0x")) {
//   const v1 = web3.utils.hexToNumberString(tokenAddress);
//   const v2 = web3.utils.hexToNumberString(tokenAddress1);
//   console.log(v1);
//   console.log(v2);
//   console.log(v1 === v2);
// } else {
//   console.log("不支持");
// }
// 1022609614459700804404024606828648442286046064602
// 1022609614459701029408687827241879653027990562503

const bs58 = require("bs58");

const address = "HHbNm24TvgRz4ayUg9nxwBWXaw6E74VYJTS1F84D4mN";
const bytes = bs58.decode(address);
// See uint8array-tools package for helpful hex encoding/decoding/compare tools
console.log(`0x${Buffer.from(bytes).toString("hex")}`);
console.log(
  web3.utils.hexToNumberString(`0x${Buffer.from(bytes).toString("hex")}`)
);
// => 003c176e659bea0f29a3e9bf7880c112b1b31b4dc826268187
