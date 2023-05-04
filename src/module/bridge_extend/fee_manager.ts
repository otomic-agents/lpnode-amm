import { IBridgeTokenConfigItem } from "../../interface/interface";
import BigNumber from "bignumber.js";
import { logger } from "../../sys_lib/logger";
import { dataConfig } from "../../data_config";
import * as _ from "lodash";
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
    logger.warn(`default fee`);
    const defaultFee = _.get(
      dataConfig.getBridgeBaseConfig(),
      "defaultFee",
      undefined
    );
    if (!defaultFee) {
      logger.error(`default Fee fee error`);
      throw new Error("default Fee fee error");
    }
    return defaultFee;
  }

  private keepLatestFee() {
    // logger.debug(this.bridgeItem);
  }
}

export { FeeManager };
