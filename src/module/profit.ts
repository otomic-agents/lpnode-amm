import { ammContextModule } from "../mongo_module/amm_context";
import { logger } from "../sys_lib/logger";
import { AmmContext } from "../interface/context";
import { SystemMath } from "../utils/system_math";
import { ProfitHelper } from "./profit_helper";
import * as _ from "lodash";
import { ISide } from "../interface/std_difi";

interface IProfit {
  origPrice: number,
  srcChainInfo: {
    userInput: {
      amount: number,
      assets: string,
      tokenName: string
    }
    received: { // 起始链收入的资产
      amount: number
      assets: string
    }[]
    systemDeduct: {
      amount: number,
      assets: string,
      fee: string
    }[]
  };
  dstChainInfo: {
    send: {
      amount: number
      assets: string
      snapshotPrice: string
      snapshotOrigPrice: string
    }[]
  };
  cexInfo: {
    hedgePlan: {
      orderId: string,
      symbol: string,
      side: ISide,
      amount: string,
      amountNumber: number
    }[]
    orders: {
      amount: number,
      symbol: string,
      slippage: string,
      fee: any,
    }[]
    assetsList: {
      assets: string, amount: number, des?: string, average: number
    }[]
  };
  profit: {
    recode: {
      amount: number,
      assets: string,
      dst: string
    }[]
  };
}

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
    const report = await this.createNewProfitReport();
    // this.process_setRawPrice(ammContext, report);
    this.process_scrChainInfo(ammContext, report);
    this.process_dstChainInfo(ammContext, report);
    this.process_cexInfo(ammContext, report);
    console.dir(report, { depth: null });
  }

  private async createNewProfitReport(): Promise<IProfit> {
    const profit = {
      origPrice: 0,
      srcChainInfo: {
        userInput: {
          amount: 0,
          assets: "",
          tokenName: ""
        },
        received: [],
        systemDeduct: []
      },
      dstChainInfo: {
        send: []
      },
      cexInfo: {
        assetsList: [],
        hedgePlan: [],
        orders: []
      },
      profit: {
        recode: []
      },

    };
    return profit;
  }

  private process_scrChainInfo(ammContext: AmmContext, report: IProfit) {
    const srcSymbol = ammContext.baseInfo.srcToken.symbol;
    report.srcChainInfo.userInput.assets = srcSymbol;
    report.srcChainInfo.userInput.amount = ammContext.swapInfo.inputAmountNumber;
    const srcChainSystemFee = profitHelper.getSystemSrcChainFee(ammContext);
    const receive = {
      amount: SystemMath.execNumber(`${ammContext.swapInfo.inputAmountNumber} *  (1-${srcChainSystemFee})`),
      assets: srcSymbol
    };
    report.srcChainInfo.received.push(receive);
    const systemDeductRecord = {
      amount: SystemMath.execNumber(`${ammContext.swapInfo.inputAmountNumber} * ${srcChainSystemFee}`),
      assets: srcSymbol,
      fee: _.attempt((): any => {
        return `${srcChainSystemFee * 100}%`;
      })
    };
    report.srcChainInfo.systemDeduct.push(systemDeductRecord);
  }

  private process_dstChainInfo(ammContext: AmmContext, report: IProfit) {
    const sendTokenRecord = {
      amount: ammContext.chainOptInfo.dstChainPayAmountNumber,
      assets: ammContext.baseInfo.dstToken.symbol,
      snapshotPrice: ammContext.quoteInfo.price,
      snapshotOrigPrice: ammContext.quoteInfo.origPrice
    };
    report.dstChainInfo.send.push(sendTokenRecord);
    const sendGasTokenRecord = {
      amount: ammContext.chainOptInfo.dstChainPayNativeTokenAmountNumber,
      assets: ammContext.baseInfo.dstChain.tokenName,
      snapshotPrice: ammContext.quoteInfo.native_token_price,
      snapshotOrigPrice: ammContext.quoteInfo.native_token_orig_price
    };
    report.dstChainInfo.send.push(sendGasTokenRecord);
  }

  private process_cexInfo(ammContext: AmmContext, report: IProfit) {
    const assetsChangeList: { assets: string, amount: number, des?: string, average: number, action: string }[] = [];
    ammContext.systemOrder.hedgeResult.forEach(orderRaw => {
      profitHelper.getAssetsRecord(orderRaw).forEach(assetsChangeItem => {
        assetsChangeList.push(assetsChangeItem);
      });
    });
    report.cexInfo.assetsList = assetsChangeList;
    // hedgePlan
    report.cexInfo.hedgePlan = ammContext.systemOrder.hedgePlan;
    // orderRecord
    const orderList: {
      amount: number,
      symbol: string,
      slippage: string,
      fee: any,
    }[] = [];
    ammContext.systemOrder.hedgeResult.forEach(orderRaw => {
      orderList.push({
        amount: _.get(orderRaw, "result.stdSymbol"),
        slippage: profitHelper.getSlippage(orderRaw),
        fee: {},
        symbol: _.get(orderRaw, "result.stdSymbol")
      });
    });
    report.cexInfo.orders = orderList;
  }
}

const profit: Profit = new Profit();
export {
  Profit,
  profit
};
