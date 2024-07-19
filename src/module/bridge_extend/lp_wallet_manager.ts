import { IBridgeTokenConfigItem } from "../../interface/interface";
import { AmmContext } from "../../interface/context";
import BigNumber from "bignumber.js";
import { evaluate } from "mathjs";
import * as math from 'mathjs';
import { logger } from "../../sys_lib/logger";
import * as _ from "lodash";

class LpWalletManager {
  // @ts-ignore
  private bridgeItem: IBridgeTokenConfigItem;

  constructor(item: IBridgeTokenConfigItem) {
    this.bridgeItem = item;
  }

  public async getReceivePrice(ammContext: AmmContext): Promise<number> {
    const inputAmountBN = new BigNumber(ammContext.swapInfo.inputAmountNumber);
    const systemSrcFee = new BigNumber(ammContext.swapInfo.systemSrcFee);
    const formula = `${inputAmountBN.toString()} - ( ${inputAmountBN.toString()} * ${systemSrcFee}) `;
    logger.info(formula);
    let lpReceive = evaluate(formula);
    lpReceive = math.format(lpReceive, { precision: 6 });
    logger.info("lp wallet receive", formula, "result:", lpReceive);
    if (!_.isFinite(lpReceive)) {
      logger.error(`evaluate error:`, "isFinite");
    }
    return lpReceive;
  }
}

export { LpWalletManager };
