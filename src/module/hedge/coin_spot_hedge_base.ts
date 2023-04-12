import { dataConfig } from "../../data_config";
import { AmmContext } from "../../interface/context";
import { ICexCoinConfig, ICoinType } from "../../interface/interface";
import { hedgeOrderIncModule } from "../../mongo_module/hedge_order_inc";
import * as _ from "lodash";

class CoinSpotHedgeBase {
  protected getTokenInfoByAmmContext(ammContext: AmmContext) {
    const tokenInfo = dataConfig.getCexStdSymbolInfoByToken(
      ammContext.baseInfo.srcToken.address,
      ammContext.baseInfo.dstToken.address,
      ammContext.baseInfo.srcToken.chainId,
      ammContext.baseInfo.dstToken.chainId
    );
    return tokenInfo;
  }

  protected getOptStdSymbol(ammContext: AmmContext) {
    const mode = _.get(ammContext, "quoteInfo.mode", undefined);
    if (mode === "11") {
      return false;
    }
    if (mode === "ss") {
      return false;
    }
    if (mode === "bs") {
      return `${ammContext.baseInfo.srcToken.symbol}/USDT`;
    }
    if (mode === "sb") {
      return `${ammContext.baseInfo.dstToken.symbol}/USDT`;
    }
    if (mode === "bb") {
      return `${ammContext.baseInfo.srcToken.symbol}/USDT`;
    }
    throw new Error(`unknown type`);
  }

  protected getStdSymbol(coinInfo: ICexCoinConfig[]) {
    if (
      coinInfo[0].coinType === ICoinType.Coin &&
      coinInfo[1].coinType === ICoinType.StableCoin
    ) {
      return `${coinInfo[0].symbol}/USDT`;
    }
    if (
      coinInfo[0].coinType === ICoinType.StableCoin &&
      coinInfo[1].coinType === ICoinType.Coin
    ) {
      return `${coinInfo[1].symbol}/USDT`;
    }
    throw "The correct symbol information was not found";
  }

  protected async getHedgeOrderId(): Promise<number> {
    const idResult = await hedgeOrderIncModule
      .findOneAndUpdate(
        {},
        { $inc: { inumber: 1 } },
        { upsert: true, returnDocument: "after" },
      )
      .lean();
    return idResult.inumber;
  }
}

export {
  CoinSpotHedgeBase
};
