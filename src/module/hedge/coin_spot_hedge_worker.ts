import { AmmContext } from "../../interface/context";
import { logger } from "../../sys_lib/logger";
import { createOrderId } from "../exchange/utils";
import BigNumber from "bignumber.js";
import { balanceLockModule } from "../../mongo_module/balance_lock";
import { CoinSpotHedgeBase } from "./coin_spot_hedge_base";
import _ from "lodash";
import { ammContextManager } from "../amm_context_manager/amm_context_manager";
import { EFlowStatus } from "../../interface/interface";
import { dataConfig } from "../../data_config";

interface IHedgeOrderItem {
  orderId: string;
  symbol: string;
  side: string;
  amount: string;
  amountNumber: number;
}

class CoinSpotHedgeWorker extends CoinSpotHedgeBase {
  public async worker(call: { orderId: number; ammContext: AmmContext }) {
    call.ammContext.bridgeItem = dataConfig.findItemByMsmqName(
      call.ammContext.systemInfo.msmqName
    );
    const optOrderList = await this.prepareOrder(call.ammContext);
    await this.freeBalanceLock(call);

    const accountIns =
      await call.ammContext.bridgeItem.hedge_info.getAccountIns();
    if (!accountIns) {
      throw new Error(
        `No instance of hedging account was found.AccountId:${call.ammContext.bridgeItem.hedge_info.getHedgeAccount()}`
      );
    }
    const cexExePlan = optOrderList;
    const cexExeResult: any[] = [];
    for (const order of optOrderList) {
      const actionSide = order.side;
      let executeFun = "";
      if (actionSide === "BUY") {
        executeFun = "spotBuy";
      }
      if (actionSide === "SELL") {
        executeFun = "spotSell";
      }
      if (order.amountNumber === 0) {
        logger.warn("忽略这个,amount为0", order.symbol, order.side);
        continue;
      }
      logger.debug(
        executeFun,
        order.orderId,
        order.symbol,
        new BigNumber(order.amountNumber).toString()
      );
      const execRow = {
        plan: order,
        result: {},
        error: "",
        status: 0,
      };
      try {
        execRow.result = await accountIns.order[executeFun](
          order.orderId,
          order.symbol,
          new BigNumber(order.amountNumber).toString()
        );
        execRow.status = 1;
      } catch (e: any) {
        execRow.error = e.toString();
      } finally {
        cexExeResult.push(execRow);
      }
    }
    try {
      await ammContextManager.appendContext(
        call.ammContext.systemOrder.orderId,
        "systemOrder.hedgePlan",
        cexExePlan
      );
      await ammContextManager.appendContext(
        call.ammContext.systemOrder.orderId,
        "systemOrder.hedgeResult",
        cexExeResult
      );
      await ammContextManager.appendContext(
        call.ammContext.systemOrder.orderId,
        "systemOrder.executed",
        1
      );
      await ammContextManager.set(call.ammContext.systemOrder.orderId, {
        flowStatus: EFlowStatus.HedgeCompletion,
      });
    } catch (e) {
      logger.error(`更新对冲记录失败`, e);
    }
  }

  public async simulationExec(optOrderList: IHedgeOrderItem[]) {
    try {
      const accountIns = await this.getAccountIns();
      for (const order of optOrderList) {
        const actionSide = order.side;
        let executeFun = "";
        if (actionSide === "BUY") {
          executeFun = "spotBuy";
        }
        if (actionSide === "SELL") {
          executeFun = "spotSell";
        }
        if (order.amountNumber === 0) {
          logger.warn("忽略这个,amount为0", order.symbol, order.side);
          continue;
        }
        logger.debug(
          "simulationExec",
          executeFun,
          order.orderId,
          order.symbol,
          new BigNumber(order.amountNumber).toString()
        );
        const execRow = {
          plan: order,
          result: {},
          error: "",
          status: 0,
        };
        try {
          execRow.result = await accountIns.order[executeFun](
            order.orderId,
            order.symbol,
            new BigNumber(order.amountNumber).toString(),
            undefined,
            true
          );
          execRow.status = 1;
        } catch (e: any) {
          execRow.error = e.toString();
          throw e;
        }
      }
    } catch (e) {
      logger.error(`仿真发生了错误`, e);
      throw e;
    }
  }

  public async prepareOrder(
    ammContext: AmmContext
  ): Promise<IHedgeOrderItem[]> {
    const mode = _.get(ammContext, "quoteInfo.mode", undefined);
    const orderList: IHedgeOrderItem[] = await this[`prepareOrder_${mode}`](
      ammContext
    );
    console.table(orderList);
    return orderList;
  }

  // @ts-ignore
  private async prepareOrder_bs(ammContext: AmmContext): IHedgeOrderItem[] {
    const leftSymbol = `${ammContext.baseInfo.srcToken.symbol}/USDT`;
    const nativeSymbol = `${ammContext.baseInfo.dstChain.tokenName}/USDT`;
    const orderList: IHedgeOrderItem[] = [];
    let orderId;
    orderId = await this.getHedgeOrderId();
    orderList.push({
      orderId: createOrderId(
        "spot",
        orderId,
        Number(ammContext.lockInfo.srcTokenPrice)
      ),
      symbol: leftSymbol,
      side: "SELL",
      amount: ammContext.chainOptInfo.srcChainReceiveAmount,
      amountNumber: ammContext.chainOptInfo.srcChainReceiveAmountNumber,
    });
    orderId = await this.getHedgeOrderId();
    orderList.push({
      orderId: createOrderId(
        "spot",
        orderId,
        Number(ammContext.lockInfo.nativeTokenPrice)
      ),
      symbol: nativeSymbol,
      side: "BUY",
      amount: ammContext.chainOptInfo.dstChainPayNativeTokenAmount,
      amountNumber: ammContext.chainOptInfo.dstChainPayNativeTokenAmountNumber,
    });
    return orderList;
  }

  // @ts-ignore
  private async prepareOrder_bb(ammContext: AmmContext): IHedgeOrderItem[] {
    const leftSymbol = `${ammContext.baseInfo.srcToken.symbol}/USDT`;
    const rightSymbol = `${ammContext.baseInfo.dstToken.symbol}/USDT`;
    const nativeSymbol = `${ammContext.baseInfo.dstChain.tokenName}/USDT`;
    const orderList: IHedgeOrderItem[] = [];
    let orderId;
    orderId = await this.getHedgeOrderId();
    orderList.push({
      orderId: createOrderId(
        "spot",
        orderId,
        Number(ammContext.lockInfo.srcTokenPrice)
      ),
      symbol: leftSymbol,
      side: "SELL",
      amount: ammContext.chainOptInfo.srcChainReceiveAmount,
      amountNumber: ammContext.chainOptInfo.srcChainReceiveAmountNumber,
    });
    orderId = await this.getHedgeOrderId();
    orderList.push({
      orderId: createOrderId(
        "spot",
        orderId,
        Number(ammContext.lockInfo.dstTokenPrice)
      ),
      symbol: rightSymbol,
      side: "BUY",
      amount: ammContext.chainOptInfo.dstChainPayAmount,
      amountNumber: ammContext.chainOptInfo.dstChainPayAmountNumber,
    });
    orderId = await this.getHedgeOrderId();
    orderList.push({
      orderId: createOrderId(
        "spot",
        orderId,
        Number(ammContext.lockInfo.nativeTokenPrice)
      ),
      symbol: nativeSymbol,
      side: "BUY",
      amount: ammContext.chainOptInfo.dstChainPayNativeTokenAmount,
      amountNumber: ammContext.chainOptInfo.dstChainPayNativeTokenAmountNumber,
    });
    return orderList;
  }

  // @ts-ignore
  private async prepareOrder_ss(ammContext: AmmContext): IHedgeOrderItem[] {
    const nativeSymbol = `${ammContext.baseInfo.dstChain.tokenName}/USDT`;
    const orderId = await this.getHedgeOrderId();
    const orderList: IHedgeOrderItem[] = [];
    orderList.push({
      orderId: createOrderId(
        "spot",
        orderId,
        Number(ammContext.lockInfo.nativeTokenPrice)
      ),
      symbol: nativeSymbol,
      side: "BUY",
      amount: ammContext.chainOptInfo.dstChainPayNativeTokenAmount,
      amountNumber: ammContext.chainOptInfo.dstChainPayNativeTokenAmountNumber,
    });
    return orderList;
  }

  // @ts-ignore
  private async prepareOrder_11(ammContext: AmmContext): IHedgeOrderItem[] {
    const nativeSymbol = `${ammContext.baseInfo.dstChain.tokenName}/USDT`;
    const orderId = await this.getHedgeOrderId();
    const orderList: IHedgeOrderItem[] = [];
    orderList.push({
      orderId: createOrderId(
        "spot",
        orderId,
        Number(ammContext.lockInfo.nativeTokenPrice)
      ),
      symbol: nativeSymbol,
      side: "BUY",
      amount: ammContext.chainOptInfo.dstChainPayNativeTokenAmount,
      amountNumber: ammContext.chainOptInfo.dstChainPayNativeTokenAmountNumber,
    });
    return orderList;
  }

  // @ts-ignore
  private async prepareOrder_sb(ammContext: AmmContext): IHedgeOrderItem[] {
    const rightSymbol = `${ammContext.baseInfo.dstToken.symbol}/USDT`;
    const nativeSymbol = `${ammContext.baseInfo.dstChain.tokenName}/USDT`;
    const orderList: IHedgeOrderItem[] = [];
    orderList.push({
      orderId: createOrderId(
        "spot",
        ammContext.systemOrder.orderId,
        Number(ammContext.lockInfo.dstTokenPrice)
      ),
      symbol: rightSymbol,
      side: "BUY",
      amount: ammContext.chainOptInfo.dstChainPayAmount,
      amountNumber: ammContext.chainOptInfo.dstChainPayAmountNumber,
    });
    orderList.push({
      orderId: createOrderId(
        "spot",
        ammContext.systemOrder.orderId,
        Number(ammContext.lockInfo.nativeTokenPrice)
      ),
      symbol: nativeSymbol,
      side: "BUY",
      amount: ammContext.chainOptInfo.dstChainPayNativeTokenAmount,
      amountNumber: ammContext.chainOptInfo.dstChainPayNativeTokenAmountNumber,
    });
    return orderList;
  }

  private async freeBalanceLock(call: {
    orderId: number;
    ammContext: AmmContext;
  }) {
    logger.warn(call.ammContext.systemOrder.balanceLockedId, "💘💘💘💘💘💘");
    // 删除本次报价的锁定余额
    const freeRet = await balanceLockModule
      .deleteOne({
        quoteHash: call.ammContext.quoteInfo.quote_hash,
      })
      .lean();
    logger.info(freeRet, "🆓🆓🆓🆓🆓🆓🆓🆓🆓🆓🆓🆓🆓🆓");
  }
}

export { CoinSpotHedgeWorker };
