import { dataConfig } from "../../data_config";
import { AmmContext } from "../../interface/context";
import { ICexCoinConfig, ICoinType } from "../../interface/interface";
import { hedgeOrderIncModule } from "../../mongo_module/hedge_order_inc";
import * as _ from "lodash";
import { SystemMath } from "../../utils/system_math";
import { accountManager } from "../exchange/account_manager";
import { logger } from "../../sys_lib/logger";

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

  protected getOptAmountAndValue(
    ammContext: AmmContext,
    srcUnitPrice: number,
    dstUnitPrice: number
  ): [number, number] {
    logger.info("input Number:", ammContext.swapInfo.inputAmountNumber);
    const mode = _.get(ammContext, "quoteInfo.mode", undefined);
    if (mode === "11") {
      return this.optAmountValue_11(ammContext);
    }
    if (mode === "ss") {
      return this.optAmountValue_ss(ammContext);
    }
    if (mode === "bs") {
      return this.optAmountValue_bs(ammContext, srcUnitPrice, dstUnitPrice);
    }
    if (mode === "sb") {
      return this.optAmountValue_sb(ammContext, srcUnitPrice, dstUnitPrice);
    }
    if (mode === "bb") {
      return this.optAmountValue_bb(ammContext, srcUnitPrice, dstUnitPrice);
    }
    throw new Error(`unknown type`);
  }

  private optAmountValue_11(ammContext: AmmContext): [number, number] {
    return [-1, -1];
  }

  private optAmountValue_ss(ammContext: AmmContext): [number, number] {
    return [-1, -1];
  }

  private optAmountValue_bs(
    ammContext: AmmContext,
    srcUnitPrice: number,
    dstUnitPrice: number
  ): [number, number] {
    const fee = ammContext.bridgeItem.fee_manager.getQuotationPriceFee();
    const value = SystemMath.exec(
      `${ammContext.swapInfo.inputAmountNumber} * ${srcUnitPrice} * (1-${fee})`
    );
    const amount = ammContext.swapInfo.inputAmountNumber;
    return [amount, Number(value.toString())];
  }

  private optAmountValue_sb(
    ammContext: AmmContext,
    srcUnitPrice: number,
    dstUnitPrice: number
  ): [number, number] {
    const fee = ammContext.bridgeItem.fee_manager.getQuotationPriceFee();
    const value = SystemMath.exec(`
      ${ammContext.swapInfo.inputAmountNumber} *
      (1-${fee})
    `);
    const amount = SystemMath.exec(`
      ${ammContext.swapInfo.inputAmountNumber} *
      (1-${fee}) /
      ${dstUnitPrice}`);
    return [Number(amount.toString()), Number(value.toString())];
  }

  private optAmountValue_bb(
    ammContext: AmmContext,
    srcUnitPrice: number,
    dstUnitPrice: number
  ): [number, number] {
    const fee = ammContext.bridgeItem.fee_manager.getQuotationPriceFee();
    const value = SystemMath.exec(
      `${ammContext.swapInfo.inputAmountNumber} * ${srcUnitPrice} * (1-${fee})`
    );
    const amount = ammContext.swapInfo.inputAmountNumber;
    return [amount, Number(value.toString())];
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
        { upsert: true, returnDocument: "after" }
      )
      .lean();
    return idResult.inumber;
  }
  protected async getAccountIns() {
    const accountIns = await accountManager.getAccount(
      (await dataConfig.getHedgeConfig()).hedgeAccount
    );
    if (!accountIns) {
      throw new Error(
        `No instance of hedging account was found.AccountId:${
          (await dataConfig.getHedgeConfig()).hedgeAccount
        }`
      );
    }
    return accountIns;
  }
}

export { CoinSpotHedgeBase };
