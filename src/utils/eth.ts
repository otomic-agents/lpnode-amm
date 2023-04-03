import { logger } from "../sys_lib/logger";

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
  throw new Error(`没有找到类型`);
}

class EthUnit {

  static toWei(input: string, unit: number) {
    const weiStr = getUnitStr(unit);
    logger.debug(input, weiStr);
    return web3.utils.toWei(input, weiStr);
  }

  static fromWei(input: string, unit: number) {

    const weiStr = getUnitStr(unit);
    logger.debug(input, weiStr);
    return web3.utils.fromWei(input, weiStr);

  }

  static fromWeiToNumber(input: string, unit: number) {
    const weiStr = getUnitStr(unit);
    logger.debug(input, weiStr);
    const ret = web3.utils.fromWei(input, weiStr);
    return Number(new BigNumber(ret).toFixed(8).toString());
  }

}

export {
  EthUnit
};
