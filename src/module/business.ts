/**
 * 事件处理逻辑，主要对应，做价格验证和对冲，这里是一个Ctrl ，细化逻辑需要拆到Service中
 */
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
import { IBridgeTokenConfigItem, ILpCmd } from "../interface/interface";
import { eventProcessLock } from "./event_process/lock";
import { eventProcessTransferOut } from "./event_process/transferout";
import { eventProcessTransferOutConfirm } from "./event_process/transferout_confirm";
import { quotation } from "./quotation";
import { AmmContext } from "../interface/context";
import { ammContextModule } from "../mongo_module/amm_context";

class Business {
  public async askQuote(msg: IEVENT_ASK_QUOTE, channel: string) {
    if (!channel) {
      logger.error(`channel不能是空的.`);
      return;
    }
    const bridgeItem: IBridgeTokenConfigItem =
      dataConfig.findItemByMsmqName(channel);
    if (!bridgeItem) {
      logger.error(`没有找到正确的bridge配置，channelName:${channel}`);
      return;
    }
    const AmmContext = await this.makeAmmContext(bridgeItem, msg);
    await quotation.asksQuote(AmmContext);
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
      },
      {
        precision: number;
        address: string;
        coinType: string;
        symbol: string;
        chainId: number;
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
          tokenName: dataConfig.getChainTokenName(token0.chainId),
        },
        dstChain: {
          id: token1.chainId,
          tokenName: dataConfig.getChainTokenName(token1.chainId),
        },
        srcToken: {
          precision: token0.precision,
          cexPrecision: 0,
          address: token0.address,
          coinType: token0.coinType,
          symbol: token0.symbol,
          chainId: token0.chainId,
        },
        dstToken: {
          precision: token1.precision,
          cexPrecision: 0,
          address: token1.address,
          coinType: token1.coinType,
          symbol: token1.symbol,
          chainId: token1.chainId,
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
      },
      quoteInfo: {
        src_usd_price: "",
        usd_price: "",
        price: "",
        quote_hash: "",
        mode: "",
        origPrice: "",
        origTotalPrice: "",
        native_token_price: "",
        native_token_usdt_price: "",
      },
      askTime: new Date().getTime(),
    };
    return context;
  }

  /**
   * Description 用户锁定价格时
   * @date 1/17/2023 - 9:11:56 PM
   * 1. 检查报价时间是否有过期 💢
   * 2. 价格这里本地短期内有没有报过 💢 hash 验证，目前数据无返回
   * 3. lp的id 是否正确
   * 4. hash 记录一下hash 💢 hash 验证，目前数据无返回
   * 5. 检查价格的偏差 💢 加入了千3 的验证暂时
   * 6. 检查是否和报价时的钱包配置等是一致的
   * @public
   * @async
   * @param {IEVENT_LOCK_QUOTE} msg ""
   * @returns {*} ""
   */
  public async lockQuote(msg: IEVENT_LOCK_QUOTE) {
    await eventProcessLock.process(msg);
  }

  /**
   * Description onTransferOut 处理函数
   * @date 1/17/2023 - 9:08:53 PM
   * 1.如果没有特殊原因，应当尽量完成B链的Cmd 发送 CMD_TRANSFER_IN
   * 2. 验证数据是否有 blockHash
   * 3. TransferIn 有可能卡在后端，迟迟不转入
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
   * src chain 确认转出事件 (Step 6 Complete)
   * 1. 这里暂时没有找到拒绝的理由
   * @msg {*} ""
   */
  public async onTransferOutConfirm(msg: any) {
    await eventProcessTransferOutConfirm.process(msg);
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

    if (Number(1) !== 1) {
      logger.warn(`用户取消转出后，系统竟然不取消.....`);
      return;
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
    redisPub.publish(ammContext.systemInfo.msmqName, cmdMsg).then(() => {
      //
    }).catch((e: any) => {
      logger.error(`回复消息到Lp发生错误`, e);
    });
  }
}

const business: Business = new Business();
export { business };
