import { AmmContext } from "../interface/context";
import * as _ from "lodash";
import { ISide } from "../interface/std_difi";
import { SystemMath } from "../utils/system_math";

class ProfitHelper {
  public getSystemSrcChainFee(ammContext: AmmContext): number {

    const fee = ammContext.swapInfo.systemSrcFee;
    if (!_.isFinite(fee)) {
      throw new Error(`fee不正确`);
    }
    return fee;
  }

  public getAssetsRecord(orderRaw) {
    const stdSymbol = _.get(orderRaw, "result.stdSymbol", "");
    const symbolInfo = stdSymbol.split("/");
    const side = _.get(orderRaw, "result.side", 0);
    const filled = _.get(orderRaw, "result.filled", 0);
    const average = _.get(orderRaw, "result.average", 0);
    const result: { assets: string, amount: number, average: number }[] = [];
    if (side === ISide.SELL) {
      result.push({
        assets: symbolInfo[1],
        average,
        amount: SystemMath.execNumber(`${filled}*${average}`)
      });
    }
    return result;
  }
}

export {
  ProfitHelper
};
