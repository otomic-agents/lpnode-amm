import { IBridgeTokenConfigItem } from "../../interface/interface";
// import { logger } from "../../sys_lib/logger";

class FeeManager {
  // @ts-ignore
  private bridgeItem: IBridgeTokenConfigItem;

  constructor(item: IBridgeTokenConfigItem) {
    this.bridgeItem = item;

    this.keepLatestFee();
  }

  getQuotationPriceFee(): number {
    // logger.debug(`来GetFee了`, this.bridgeItem);
    return 0.004;
  }

  private keepLatestFee() {
    // logger.debug(this.bridgeItem);
  }
}

export { FeeManager };
