import BigNumber from "bignumber.js";

console.log(
  new BigNumber(
    new BigNumber("0x66472e363ed5e0f30000")
      .div(new BigNumber(10).pow(18))
      .toString(10)
  ).toFixed(5)
);
// 482994.43;
