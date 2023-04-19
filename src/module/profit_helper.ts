import { AmmContext } from "../interface/context";
import * as _ from "lodash";
import { ISide } from "../interface/std_difi";
import { SystemMath } from "../utils/system_math";
import { parseOrderId } from "./exchange/utils";
import { logger } from "../sys_lib/logger";

class ProfitHelper {
  public getSystemSrcChainFee(ammContext: AmmContext): number {

    const fee = ammContext.swapInfo.systemSrcFee;
    if (!_.isFinite(fee)) {
      throw new Error(`fee不正确`);
    }
    return fee;
  }

  public getSlippage(orderRaw) {
    const clientOrderId = _.get(orderRaw, "result.clientOrderId", "");
    const origPrice = _.get(parseOrderId(clientOrderId), "price", "");
    const averagePrice = _.get(orderRaw, "result.average", 0);
    logger.debug(origPrice, averagePrice, "++++++++++++++++++");
    const slippage = SystemMath.execNumber(`abs(${origPrice}-${averagePrice}) /${origPrice}* 100`);
    let side = "-";
    if (origPrice > averagePrice) {
      side = "+";
    }
    return `${side}  ${slippage}%`;
  }

  public getAssetsRecord(orderRaw) {
    const stdSymbol = _.get(orderRaw, "result.stdSymbol", "");
    const symbolInfo = stdSymbol.split("/");
    const side = _.get(orderRaw, "result.side", 0);
    const filled = _.get(orderRaw, "result.filled", 0);
    const average = _.get(orderRaw, "result.average", 0);
    console.dir(parseOrderId(_.get(orderRaw, "result.clientOrderId")));
    const result: { assets: string, amount: number, average: number, action: string }[] = [];
    if (side === ISide.SELL) {
      result.push({
        assets: symbolInfo[1],
        average,
        amount: SystemMath.execNumber(`${filled}*${average}`),
        action: "+"
      });
      result.push({
        assets: symbolInfo[0],
        average,
        amount: _.get(orderRaw, "result.filled", 0),
        action: "-"
      });
    }
    return result;
  }
}

export {
  ProfitHelper
};
