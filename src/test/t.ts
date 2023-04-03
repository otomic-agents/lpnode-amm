// import BigNumber from "bignumber.js";
// const { ethers } = require("ethers");
// function main() {
//   const big = ethers.BigNumber.from("0x66472e363ed5e0f30000");
//   console.log();
// }
// main();

import { TimeOutPromise } from "../sys_lib/time_out_promise";

async function main() {
  try {
    const result: string = await TimeOutPromise((resolve, reject) => {
      setTimeout(() => {
        resolve("100");
      }, 10000);
    });
    console.log(result);
  } catch (e) {
    console.error(e);
  }
}
main();
