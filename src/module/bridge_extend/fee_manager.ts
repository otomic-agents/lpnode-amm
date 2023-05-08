import { IBridgeTokenConfigItem } from "../../interface/interface";
import BigNumber from "bignumber.js";
import { logger } from "../../sys_lib/logger";

// import { logger } from "../../sys_lib/logger";

class FeeManager {
  // @ts-ignore
  private bridgeItem: IBridgeTokenConfigItem;

  constructor(item: IBridgeTokenConfigItem) {
    this.bridgeItem = item;

    this.keepLatestFee();
  }

  getQuotationPriceFee(): number {
    logger.debug(`init fee bignumber`, this.bridgeItem.fee);
    const feeBigNumber = new BigNumber(this.bridgeItem.fee);
    if (feeBigNumber.isFinite()) {
      const fee = Number(feeBigNumber);
      logger.info(`fee`, fee);
      return Number(fee);
    }
    logger.warn(`没有获取到Fee的配置，使用默认值替代`);
    return 0.004;
  }

  private keepLatestFee() {
    // logger.debug(this.bridgeItem);
  }
}

export { FeeManager };
