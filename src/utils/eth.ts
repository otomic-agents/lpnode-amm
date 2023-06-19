const Web3 = require("web3");
const web3 = new Web3();
import BigNumber from "bignumber.js";

function getUnitStr(unit: number) {
  unit = unit + 1;
  for (const item in web3.utils.unitMap) {
    if (web3.utils.unitMap[item].length === unit) {
      return item;
    }
  }
  throw new Error(`type not found`);
}

class EthUnit {
  static toWei(input: string, unit: number) {
    const weiStr = getUnitStr(unit);
    return web3.utils.toWei(input, weiStr);
  }

  static fromWei(input: string, unit: number) {
    const weiStr = getUnitStr(unit);
    return web3.utils.fromWei(input, weiStr);
  }

  static fromWeiToNumber(input: string, unit: number) {
    const weiStr = getUnitStr(unit);
    const ret = web3.utils.fromWei(input, weiStr);
    return Number(new BigNumber(ret).toFixed(8).toString());
  }
}

export { EthUnit };
