import _ from "lodash";
import { dataConfig } from "../data_config";
import { logger } from "../sys_lib/logger";
import { redisPub } from "../redis_bus";
import {
  IEVENT_ASK_QUOTE,
  IEVENT_LOCK_QUOTE,
  IEVENT_TRANSFER_OUT,
  IEVENT_TRANSFER_OUT_CONFIRM,
} from "../interface/event";
import {
  EFlowStatus,
  IBridgeTokenConfigItem,
  ILpCmd,
} from "../interface/interface";
import { eventProcessLock } from "./event_process/lock";
import { eventProcessTransferOut } from "./event_process/transferout";
import { eventProcessTransferOutConfirm } from "./event_process/transferout_confirm";
import { quotation } from "./quotation";
import { AmmContext } from "../interface/context";
import { ammContextModule } from "../mongo_module/amm_context";
import { eventProcessTransferInConfirm } from "./event_process/transferin_confirm";
import { eventProcessTransferIn } from "./event_process/transferin";
import { eventProcessTransferInRefund } from "./event_process/transferin_refund";

class Business {
  public async askQuote(msg: IEVENT_ASK_QUOTE, channel: string) {
    logger.info("ask quote message:", msg);
    if (!channel) {
      logger.error(`channel cannot be empty.`);
      return;
    }
    const bridgeItem: IBridgeTokenConfigItem =
      dataConfig.findItemByMsmqName(channel);
    if (!bridgeItem) {
      logger.error(`The correct bridge configuration was not found:${channel}`);
      return;
    }
    const AmmContext = await this.makeAmmContext(bridgeItem, msg);
    await quotation.asksQuote(AmmContext);
  }
  public async lockQuote(msg: IEVENT_LOCK_QUOTE) {
    await eventProcessLock.process(msg);
  }

  /**
   * onTransferOut Function
   * @date 1/17/2023 - 9:08:53 PM
   * @public
   * @async
   * @param {*} msg any
   * @returns {*} void
   */
  public async onTransferOut(msg: IEVENT_TRANSFER_OUT) {
    await eventProcessTransferOut.process(msg);
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * @msg {*} ""
   */
  public async onTransferOutConfirm(msg: any) {
    await eventProcessTransferOutConfirm.process(msg);
  }

  public async onTransferIn(msg: any) {
    eventProcessTransferIn.process(msg);
  }
  public async onTransferInConfirm(msg: any) {
    eventProcessTransferInConfirm.process(msg);
  }
  public async onTransferInRefund(msg: any) {
    eventProcessTransferInRefund.process(msg);
  }
  private getLpOrderId(msg: IEVENT_TRANSFER_OUT_CONFIRM): number {
    const orderInfo = _.get(
      msg,
      "business_full_data.pre_business.order_append_data",
      "{}"
    );
    if (!orderInfo) {
      logger.error("order information could not be found...");
      return 0;
    }
    const orderId = _.get(JSON.parse(orderInfo), "orderId", undefined);
    if (!orderId || !_.isFinite(orderId)) {
      logger.error("orderId parsing failed...");
      return 0;
    }
    return orderId;
  }

  public async onTransferOutRefund(msg: any) {
    const orderId = this.getLpOrderId(msg);
    const ammContext: AmmContext = await ammContextModule
      .findOne({
        "systemOrder.orderId": orderId,
      })
      .lean();
    if (!ammContext) {
      throw new Error("No order information found");
    }

    const cmdMsg = JSON.stringify({
      cmd: ILpCmd.CMD_TRANSFER_IN_REFUND,
      business_full_data: _.get(msg, "business_full_data"),
    });
    logger.debug(
      `🟦🟦🟦🟦🟦🟦🟦-->`,
      ILpCmd.CMD_TRANSFER_IN_REFUND,
      "Channel",
      ammContext.systemInfo.msmqName,
      cmdMsg
    );
    redisPub
      .publish(ammContext.systemInfo.msmqName, cmdMsg)
      .then(() => {
        //
      })
      .catch((e: any) => {
        logger.error(`Reply message to Lp Error:`, e);
      });
  }
  private async makeAmmContext(
    item: IBridgeTokenConfigItem,
    msg: IEVENT_ASK_QUOTE
  ): Promise<AmmContext> {
    const [token0, token1]: [
      {
        precision: number;
        address: string;
        coinType: string;
        symbol: string;
        chainId: number;
        tokenName: string;
      },
      {
        precision: number;
        address: string;
        coinType: string;
        symbol: string;
        chainId: number;
        tokenName: string;
      }
    ] = dataConfig.getCexStdSymbolInfoByToken(
      item.srcToken,
      item.dstToken,
      item.src_chain_id,
      item.dst_chain_id
    );
    if (!token0 || !token1) {
      logger.error(`token not found`);
      throw new Error("token not found");
    }
    const context: AmmContext = {
      appName: _.get(process.env, "APP_NAME", ""),
      hedgeEnabled: item.enable_hedge,
      summary: `chainInfo: ${token0.chainId}-${token1.chainId} ,swapInfo: ${token0.symbol}-${token1.symbol}`,
      systemContext: {
        lockStepInfo: {},
        transferoutConfirmInfo: {},
      },
      tradeStatus: 0,
      profitStatus: 0,
      bridgeItem: item,
      step: 0,
      systemOrder: {
        hedgePlan: [],
        hedgeResult: [],
        orderId: 0,
        balanceLockedId: "",
        bridgeConfig: {},
      },
      chainOptInfo: {
        srcChainReceiveAmount: "",
        srcChainReceiveAmountNumber: 0,
        dstChainPayAmount: "",
        dstChainPayAmountNumber: 0,
        dstChainPayNativeTokenAmount: "",
        dstChainPayNativeTokenAmountNumber: 0,
      },
      systemInfo: {
        msmqName: item.msmq_name,
      },
      lockInfo: {
        fee: "",
        price: "0",
        nativeTokenPrice: "",
        time: 0,
        dstTokenPrice: "",
        srcTokenPrice: "",
      },
      walletInfo: {
        walletName: item.wallet.name,
      },
      baseInfo: {
        fee: item.fee_manager.getQuotationPriceFee(),
        srcChain: {
          id: token0.chainId,
          nativeTokenName: dataConfig.getChainTokenName(token0.chainId),
          nativeTokenPrecision: dataConfig.getChainNativeTokenPrecision(
            token0.chainId
          ),
          tokenName: dataConfig.getChainTokenName(token0.chainId),
        },
        dstChain: {
          id: token1.chainId,
          nativeTokenName: dataConfig.getChainTokenName(token1.chainId),
          nativeTokenPrecision: dataConfig.getChainNativeTokenPrecision(
            token1.chainId
          ),
          tokenName: dataConfig.getChainTokenName(token1.chainId),
        },
        srcToken: {
          precision: token0.precision,
          cexPrecision: 0,
          address: token0.address,
          coinType: token0.coinType,
          symbol: token0.symbol,
          chainId: token0.chainId,
          tokenName: token0.tokenName,
        },
        dstToken: {
          precision: token1.precision,
          cexPrecision: 0,
          address: token1.address,
          coinType: token1.coinType,
          symbol: token1.symbol,
          chainId: token1.chainId,
          tokenName: token1.tokenName,
        },
      },
      AskInfo: {
        cid: _.get(msg, "cid", ""),
      },
      swapInfo: {
        inputAmount: _.get(msg, "amount", ""),
        inputAmountNumber: Number(_.get(msg, "amount", "0")),
        systemSrcFee: 0,
        systemDstFee: 0,
        lpReceiveAmount: 0,
        srcAmount: "",
        dstAmount: "",
        srcAmountNumber: 0,
        dstAmountNumber: 0,
        dstNativeAmount: "0",
        dstNativeAmountNumber: 0,
        stepTimeLock: 0,
      },
      quoteInfo: {
        src_usd_price: "",
        dst_usd_price: "",
        price: "",
        quote_hash: "",
        mode: "",
        origPrice: "",
        origTotalPrice: "",
        native_token_price: "",
        native_token_usdt_price: "",
        native_token_orig_price: "",
        capacity_num: 0,
      },
      askTime: new Date().getTime(),
      flowStatus: EFlowStatus.Init,
      transferoutConfirmTime: 0,
    };
    return context;
  }
}

const business: Business = new Business();
export { business };
