/* eslint-disable arrow-parens */
import { ammContextModule } from "../mongo_module/amm_context";
import { logger } from "../sys_lib/logger";
import { AmmContext } from "../interface/context";
import { SystemMath } from "../utils/system_math";
import { ProfitHelper } from "./profit_helper";
import * as _ from "lodash";

import { IProfit, IProfitAssetsRecord } from "./profit_interface";

const profitHelper = new ProfitHelper();

class Profit {
  public process() {
    this.scanContext();
  }

  private async scanContext() {
    try {
      const ammContext: AmmContext = await ammContextModule.findOne({}).lean();
      if (!ammContext) {
        //
      }
      await this.processItem(ammContext);
    } catch (e) {
      logger.error(e);
    }
  }

  private async processItem(ammContext: AmmContext) {
    const report = await this.createNewProfitReport(ammContext);
    // this.process_setRawPrice(ammContext, report);
    this.process_userInput(ammContext, report);
    this.process_scrChainInfo(ammContext, report);
    this.process_dstChainInfo(ammContext, report);
    this.process_cexInfo(ammContext, report);
    console.log(JSON.stringify(report));
    console.dir(report, { depth: null });
  }

  private async createNewProfitReport(
    ammContext: AmmContext
  ): Promise<IProfit> {
    const profit = {
      priceInfo: {
        coinPrice: ammContext.quoteInfo.price,
        coinOrigPrice: ammContext.quoteInfo.origPrice,
        nativeCoinPrice: ammContext.quoteInfo.native_token_price,
        nativeCoinOrigPrice: ammContext.quoteInfo.native_token_orig_price,
      },
      userInput: {
        amount: 0,
        assets: "",
        tokenName: "",
      },
      srcChainInfo: {
        received: [],
        systemDeduct: [],
      },
      dstChainInfo: {
        send: [],
        systemDeduct: [],
      },
      cexInfo: {
        assetsList: [],
        hedgePlan: [],
        orders: [],
      },
      profit: {
        recode: [],
      },
    };
    return profit;
  }

  private process_userInput(ammContext, report: IProfit) {
    const srcSymbol = ammContext.baseInfo.srcToken.symbol;
    report.userInput.assets = srcSymbol;
    report.userInput.amount = ammContext.swapInfo.inputAmountNumber;
  }
  private process_scrChainInfo(ammContext: AmmContext, report: IProfit) {
    const srcSymbol = ammContext.baseInfo.srcToken.symbol;
    const srcChainSystemFee = profitHelper.getSystemSrcChainFee(ammContext);
    const receive = {
      amount: SystemMath.execNumber(
        `${ammContext.swapInfo.inputAmountNumber} *  (1-${srcChainSystemFee})`
      ),
      assets: srcSymbol,
    };
    report.srcChainInfo.received.push(receive);
    const systemDeductRecord = {
      amount: SystemMath.execNumber(
        `${ammContext.swapInfo.inputAmountNumber} * ${srcChainSystemFee}`
      ),
      assets: srcSymbol,
      fee: _.attempt((): any => {
        return `${srcChainSystemFee * 100}%`;
      }),
    };
    report.srcChainInfo.systemDeduct.push(systemDeductRecord);
  }

  private process_dstChainInfo(ammContext: AmmContext, report: IProfit) {
    const sendTokenRecord = {
      amount: ammContext.chainOptInfo.dstChainPayAmountNumber,
      assets: ammContext.baseInfo.dstToken.symbol,
    };
    report.dstChainInfo.send.push(sendTokenRecord);
    const sendGasTokenRecord = {
      amount: ammContext.chainOptInfo.dstChainPayNativeTokenAmountNumber,
      assets: ammContext.baseInfo.dstChain.tokenName,
    };
    report.dstChainInfo.send.push(sendGasTokenRecord);
    const dstChainSystemFee = profitHelper.getSystemDstChainFee(ammContext);
    const systemDeductRecord = {
      amount: SystemMath.execNumber(
        `${ammContext.swapInfo.inputAmountNumber} * ${ammContext.quoteInfo.origPrice} * ${dstChainSystemFee}`
      ),
      assets: ammContext.baseInfo.dstToken.symbol,
      fee: _.attempt((): any => {
        return `${dstChainSystemFee * 100}%`;
      }),
    };
    report.dstChainInfo.systemDeduct.push(systemDeductRecord);
  }

  private process_cexInfo(ammContext: AmmContext, report: IProfit) {
    const assetsChangeList: IProfitAssetsRecord[] = [];
    ammContext.systemOrder.hedgeResult.forEach((orderRaw) => {
      console.dir(orderRaw);
      profitHelper.getAssetsRecord(orderRaw).forEach((assetsChangeItem) => {
        assetsChangeList.push(assetsChangeItem);
      });
    });
    report.cexInfo.assetsList = assetsChangeList;
    // hedgePlan
    report.cexInfo.hedgePlan = ammContext.systemOrder.hedgePlan;
    // orderRecord
    const orderList: {
      amount: number;
      symbol: string;
      slippage: string;
      fee: any;
    }[] = [];
    ammContext.systemOrder.hedgeResult.forEach((orderRaw) => {
      orderList.push({
        amount: _.get(orderRaw, "result.stdSymbol"),
        slippage: profitHelper.getSlippage(orderRaw),
        fee: {},
        symbol: _.get(orderRaw, "result.stdSymbol"),
      });
    });
    report.cexInfo.orders = orderList;
  }
}

const profit: Profit = new Profit();
export { Profit, profit };
