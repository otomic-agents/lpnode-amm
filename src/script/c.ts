import bs58 from "bs58";
const Web3 = require("web3");
const web3 = new Web3();
function AddressToUniq_5010(address){
    const bytes = Buffer.from(address, 'base64');
    const ud = web3.utils.hexToNumberString(
        web3.utils.bytesToHex(bytes)
    );
    return ud;
  }

  const decima_address = AddressToUniq_5010("12S8vQ5X8rpvDp6m8zGmUgdMsEen3qEt5HZgk4JTDXtM")
  
  console.log("decima_address",decima_address)
  const hex_address = `0x${Buffer.from("12S8vQ5X8rpvDp6m8zGmUgdMsEen3qEt5HZgk4JTDXtM", 'base64').toString("hex")}`
  console.log("hex_address",hex_address)

  console.log("fix_address",web3.utils.numberToHex(decima_address));
  console.log(bs58.encode(web3.utils.numberToHex(decima_address)))