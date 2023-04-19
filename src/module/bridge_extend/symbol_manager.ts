import { dataConfig } from "../../data_config";
import { AmmContext } from "../../interface/context";
import { IBridgeTokenConfigItem } from "../../interface/interface";
// import { logger } from "../../sys_lib/logger";

class SymbolManager {
  // @ts-ignore
  private bridgeItem: IBridgeTokenConfigItem;

  constructor(item: IBridgeTokenConfigItem) {
    this.bridgeItem = item;
  }

  public getSrcStableStdSymbol(ammContext: AmmContext) {
    return `${ammContext.baseInfo.srcToken.symbol}/USDT`;
  }
  public getDstStableStdSymbol(ammContext: AmmContext) {
    return `${ammContext.baseInfo.dstToken.symbol}/USDT`;
  }
  public getGasTokenStableStdSymbol(ammContext: AmmContext) {
    const gasSymbol = dataConfig.getChainTokenName(
      ammContext.baseInfo.dstChain.id
    );
    return `${gasSymbol}/USDT`;
  }
}

export { SymbolManager };
