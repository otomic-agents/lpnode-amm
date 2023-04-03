// @ts-ignore
const Web3 = require("web3");
// @ts-ignore
const web3 = new Web3();

const account = web3.eth.accounts.privateKeyToAccount(
  "51ca8c970c41e8550454dbdd0a8eb4dbc2a95a33fb397c0a064bd204c0678fde"
);

console.log(account);
