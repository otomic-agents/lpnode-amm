import _ from "lodash";
import { IEVENT_LOCK_QUOTE } from "../../interface/event";
import { logger } from "../../sys_lib/logger";

import { redisPub } from "../../redis_bus";
import {
  EFlowStatus,
  ETradeStatus,
  IBridgeTokenConfigItem,
  ILpCmd,
} from "../../interface/interface";
import { dataConfig } from "../../data_config";
import { quotation } from "../quotation";
import BigNumber from "bignumber.js";
import { quotationListHistory } from "../quotation/quotation_history";
import { BaseEventProcess } from "./base_event_process";
import { CreateRecord } from "./system_record";
import { ammContextModule } from "../../mongo_module/amm_context";
import { AmmContext } from "../../interface/context";
import { orderIncModule } from "../../mongo_module/order_inc";
import { EthUnit } from "../../utils/eth";
import { ammContextManager } from "../amm_context_manager/amm_context_manager";
import { SystemMath } from "../../utils/system_math";
import { getNumberFrom16 } from "../../utils/ethjs_unit";
import { chainBalanceLock } from "../chain_balance_lock";
import { chainBalance } from "../chain_balance";
import { LogExecutionTime } from "../../utils/utils";

const stringify = require("json-stringify-safe");

interface IVerificationEngineReulst {
  ok: boolean;
  msg: string;
}

class EventProcessLock extends BaseEventProcess {
  // @ts-ignore
  private engineContext: any;
  // @ts-ignore
  private dataContext: EventProcessLock;
  private rules: any[] = [
    {
      // Verify that the timestamp of quote
      path: "pre_business.swap_asset_information.quote.timestamp",
      disable: true, // Temporarily closed
      valueVefFun: (v: any, context: any) => {
        if (!v) {
          return [
            false,
            `pre_business.swap_asset_information.quote.timestamp empty`,
          ];
        }
        const awaytime = new Date().getTime() - Number(v);
        if (awaytime <= 1000 * 60 * 5) {
          // Expiration time 5 minutes
          return [true, ""];
        }
        return [false, `expired:${awaytime / 100}Sec`];
      },
    },
    {
      path: "pre_business.swap_asset_information.quote.hash",
      disable: true, // Temporarily closed
      valueVefFun: (v: any, context: any) => {
        if (!v) {
          return [false, "quote Hash can't empty"];
        }
        return [true, ""];
      },
    },
  ];
  @LogExecutionTime
  public async process(msg: IEVENT_LOCK_QUOTE): Promise<void> {
    console.dir(msg, { depth: 5 });
    const quoteHash = _.get(
      msg,
      "pre_business.swap_asset_information.quote.quote_base.quote_hash",
      undefined
    );
    if (!quoteHash) {
      throw new Error(`no quoteHash found`);
    }
    const ammContext: AmmContext =
      await ammContextManager.getContextByQuoteHash(quoteHash);
    if (!ammContext) {
      throw new Error(`no context found`);
    }
    ammContext.bridgeItem = dataConfig.findItemByMsmqPath(
      ammContext.systemInfo.msmqName
    );
    if (!ammContext) {
      throw new Error(`No historical inquiry found`);
    }

    const [srcFee, dstFee] = this.getFeeInfoFromMsg(msg);
    ammContext.swapInfo.srcAmount = _.get(
      msg,
      "pre_business.swap_asset_information.amount",
      ""
    );
    ammContext.swapInfo.stepTimeLock = _.get(
      msg,
      "pre_business.swap_asset_information.step_time_lock",
      0
    );
    ammContext.swapInfo.systemSrcFee = srcFee;
    _.set(ammContext, "systemContext.lockStepInfo", msg);
    ammContext.systemContext.lockStepInfo = msg;
    ammContext.swapInfo.systemDstFee = dstFee;
    ammContext.swapInfo.dstSourceAmount = ammContext.swapInfo.dstAmount = _.get(
      msg,
      "pre_business.swap_asset_information.dst_amount",
      "0"
    );
    ammContext.swapInfo.dstSourceNativeAmount = ammContext.swapInfo.dstAmount = _.get(
      msg,
      "pre_business.swap_asset_information.dst_native_amount",
      "0"
    );
    ammContext.swapInfo.dstAmount = _.get(
      msg,
      "pre_business.swap_asset_information.dst_amount_need",
      "0"
    );
    ammContext.swapInfo.dstNativeAmount = _.get(
      msg,
      "pre_business.swap_asset_information.dst_native_amount_need",
      "0"
    );
    ammContext.swapInfo;
    let systemOrder;
    let orderId;
    try {
      if (_.get(ammContext, "lockInfo.time", 0) > 0) {
        logger.error(`It is not possible to lock the same quote repeatedly`);
        throw new Error("It is not possible to lock the same quote repeatedly");
      }
      await this.runVerificationEngine(msg); // Validate data
      await this.verificationStepTime(ammContext, msg); // Validate data
      await this.verificationDexBalance(ammContext); // Check Des balance
      await this.verificationHistory(ammContext, msg); // Check history quote
      await this.checkSpread(ammContext, msg); // Check spread
      await this.setMemoryContext(msg, ammContext);
      await this.verificationLockValue(ammContext, msg); // Check the value of the operation lock
      ammContext.swapInfo.lpReceiveAmount =
        await ammContext.bridgeItem.lp_wallet_info.getReceivePrice(ammContext);
      if (ammContext.hedgeEnabled) {
        await this.verificationHedge(ammContext, msg); // Verify that hedging is possible
      }
      [orderId, systemOrder] = await this.createSystemOrder(ammContext, msg); // Create system order
      _.set(
        msg,
        "pre_business.order_append_data",
        JSON.stringify({
          orderId,
        })
      ); // return orderId
      _.set(msg, "pre_business.locked", true);
      _.set(msg, "pre_business.lock_message", "");
      logger.info(`new orderId:${orderId}`);
    } catch (e) {
      const err: any = e;
      logger.error(`lock has been rejected Error:${err.toString()}`);
      _.set(msg, "pre_business.order_append_data", JSON.stringify({}));
      _.set(msg, "pre_business.locked", false);
      _.set(msg, "pre_business.lock_message", err.toString());
    } finally {
      await this.response(msg, ammContext.systemInfo.msmqName);
    }
    _.set(systemOrder, "orderId", orderId);
    console.log(`
    🚀 =============================================
    📌 SWAP INFO DEBUG OUTPUT
    =============================================
    ${JSON.stringify(ammContext.swapInfo, null, 2)}
    =============================================
    ⏰ ${new Date().toISOString()}
    `);
    await ammContextModule.updateOne(
      {
        "quoteInfo.quote_hash": _.get(
          msg,
          "pre_business.swap_asset_information.quote.quote_base.quote_hash",
          ""
        ),
      },
      {
        $set: {
          flowStatus: EFlowStatus.Locked,
          tradeStatus: ETradeStatus.Locked,
          lockMsg: _.get(msg, "pre_business.err_msg", ""),
          systemContext: ammContext.systemContext,
          swapAssetInformation: msg.pre_business.swap_asset_information,
          swapInfo: ammContext.swapInfo,
          step: 1,
          systemOrder,
          "lockInfo.fee": ammContext.lockInfo.fee,
          "lockInfo.time": new Date().getTime(),
          "lockInfo.price": ammContext.quoteInfo.origPrice,
          "lockInfo.nativeTokenPrice":
            ammContext.quoteInfo.native_token_usdt_price.toString(),
          "lockInfo.dstTokenPrice": ammContext.quoteInfo.dst_usd_price,
          "lockInfo.srcTokenPrice": ammContext.quoteInfo.src_usd_price,
        },
      }
    );
  }

  private async setMemoryContext(
    msg: IEVENT_LOCK_QUOTE,
    ammContext: AmmContext
  ) {
    const receive = await ammContext.bridgeItem.lp_wallet_info.getReceivePrice(
      ammContext
    );
    const receiveStr = EthUnit.toWei(
      receive.toString(),
      ammContext.baseInfo.srcToken.precision
    );
    ammContext.chainOptInfo.srcChainReceiveAmount = receiveStr;
    ammContext.chainOptInfo.srcChainReceiveAmountNumber = receive;
    const dstChainPayAmountRaw = _.get(
      msg,
      "pre_business.swap_asset_information.dst_amount",
      ""
    );
    const dstChainPayAmountNumber = getNumberFrom16(
      dstChainPayAmountRaw,
      ammContext.baseInfo.dstToken.precision
    );
    ammContext.chainOptInfo.dstChainPayAmount = dstChainPayAmountRaw;
    ammContext.chainOptInfo.dstChainPayAmountNumber = dstChainPayAmountNumber;

    const dstChainPayNativeTokenAmountRaw = _.get(
      msg,
      "pre_business.swap_asset_information.dst_native_amount",
      ""
    );
    const dstChainPayNativeTokenAmountNumber = getNumberFrom16(
      dstChainPayNativeTokenAmountRaw,
      ammContext.baseInfo.dstChain.nativeTokenPrecision
    );

    ammContext.chainOptInfo.dstChainPayNativeTokenAmount =
      dstChainPayNativeTokenAmountRaw;
    ammContext.chainOptInfo.dstChainPayNativeTokenAmountNumber =
      dstChainPayNativeTokenAmountNumber;
  }

  private verificationLockValue(
    ammContext: AmmContext,
    msg: IEVENT_LOCK_QUOTE
  ) {
    const dstAmountRaw = _.get(
      msg,
      "pre_business.swap_asset_information.dst_amount",
      undefined
    );
    if (!dstAmountRaw) {
      throw new Error("dst_amount amount is empty");
    }
    const dstAmount = EthUnit.fromWei(
      dstAmountRaw,
      ammContext.baseInfo.dstToken.precision
    );

    const formula = `1/${ammContext.quoteInfo.origPrice}*${dstAmount}`;
    const dstTokenToSrcTokenValue = SystemMath.exec(
      formula,
      "dstTokenValue calculate"
    );
    logger.info(`dstNativeToken = srcTokenCount:`, dstTokenToSrcTokenValue);

    const dstNativeAmountRaw = _.get(
      msg,
      "pre_business.swap_asset_information.dst_native_amount",
      undefined
    );
    if (!dstNativeAmountRaw) {
      throw new Error(`dst_native_amount amount is empty`);
    }
    // console.log(ammContext);
    const dstNativeAmount = EthUnit.fromWei(
      dstNativeAmountRaw,
      ammContext.baseInfo.dstChain.nativeTokenPrecision
    );
    const formulaNative = `1/${ammContext.quoteInfo.native_token_orig_price}*${dstNativeAmount}`;
    const dstNativeTokenToSrcTokenValue = SystemMath.exec(
      formulaNative,
      "dstNativeTokenValue calculate"
    );
    logger.info(
      `dstNativeToken = srcTokenCount:`,
      dstNativeTokenToSrcTokenValue
    );
    const feeFormula = `1-(${dstTokenToSrcTokenValue}+${dstNativeTokenToSrcTokenValue})/${ammContext.swapInfo.inputAmountNumber}`;
    logger.info(feeFormula);
    const fee = SystemMath.execNumber(feeFormula, "fee calculate");
    logger.info("swap fee:", fee);
    ammContext.lockInfo.fee = fee.toString();
    if (
      ammContext.bridgeItem.fee_manager.getQuotationPriceFee() - fee >
      0.001
    ) {
      throw "swap fee overflow";
    }
  }

  private getFeeInfoFromMsg(msg: IEVENT_LOCK_QUOTE): [number, number] {
    const systemSrcFeeRaw = _.get(
      msg,
      "pre_business.swap_asset_information.system_fee_src",
      0
    );
    const systemDstFeeRaw = _.get(
      msg,
      "pre_business.swap_asset_information.system_fee_dst",
      0
    );
    let systemSrcFee = 0;
    let systemDstFee = 0;
    if (systemSrcFeeRaw > 0) {
      systemSrcFee = systemSrcFeeRaw / 10000;
    }
    if (systemDstFeeRaw > 0) {
      systemDstFee = systemDstFeeRaw / 10000;
    }
    return [systemSrcFee, systemDstFee];
  }

  /**
   * Check the price difference between Quote and Lock
   * @date 1/18/2023 - 2:24:09 PM
   *
   * @private
   * @async
   * @param {AmmContext} ammContext ""
   * @param {IEVENT_LOCK_QUOTE} msg ""
   * @returns {*} ""
   */
  private async checkSpread(ammContext: AmmContext, msg: IEVENT_LOCK_QUOTE) {
    const curPrice = await quotation.queryRealtimeQuote(ammContext);
    const historyPrice = _.get(
      msg,
      "pre_business.swap_asset_information.quote.quote_base.price",
      undefined
    );
    if (!historyPrice) {
      logger.warn(
        `An error occurred while obtaining the locked price,The original value is:`,
        _.get(msg, "pre_business.swap_asset_information.quote.quote_base.price")
      );
      throw new Error(`can't fand locked price`);
    }
    const historyBN = new BigNumber(historyPrice);
    const curBN = new BigNumber(curPrice);
    const spreadBN = historyBN.minus(curBN).div(historyBN);
    const spread = spreadBN.toFixed(3);
    logger.info(`locked spread is:${spread}`);

    logger.info(`Lock quote spread ${spread}`);
    if (spreadBN.gt(new BigNumber(0.003))) {
      console.log("max spread");
      throw new Error(`max spread ${spread.toString()}`);
    }
  }

  /**
   * Description rule engine
   * @date 1/18/2023 - 1:27:39 PM
   *
   * @public
   * @async
   * @param {IEVENT_LOCK_QUOTE} msg "raw data"
   * @returns {Promise<IVerificationEngineReulst>} ""
   */
  public async runVerificationEngine(
    msg: IEVENT_LOCK_QUOTE
  ): Promise<IVerificationEngineReulst> {
    for (const rule of this.rules) {
      const v = _.get(msg, rule.path, undefined);
      const disable: boolean = _.get(rule, "disable", false);
      if (disable) {
        continue;
      }
      const [ok, message] = rule.valueVefFun(v);
      if (!ok) {
        throw new Error(message);
      }
    }
    return {
      ok: true,
      msg: "verification",
    };
  }
  public async verificationStepTime(
    ammContext: AmmContext,
    msg: IEVENT_LOCK_QUOTE
  ): Promise<void> {
    return;
    const limitTime = _.get(
      msg,
      "pre_business.swap_asset_information.step_time_lock",
      0
    );
    const createTime = _.get(
      msg,
      "pre_business.swap_asset_information.agreement_reached_time",
      0
    );
    const srcTimeLimitForLock = _.get(
      _.find(dataConfig.getRawChainDataConfig(), {
        chainId: ammContext.baseInfo.srcChain.id,
      }),
      "config.timeLimitForLock",
      300
    );
    const dstTimeLimitForLock = _.get(
      _.find(dataConfig.getRawChainDataConfig(), {
        chainId: ammContext.baseInfo.dstChain.id,
      }),
      "config.timeLimitForLock",
      300
    );
    const maxTimeLimitForLock = Math.max(
      srcTimeLimitForLock,
      dstTimeLimitForLock
    );
    logger.info(
      "maxTimeLimitForLock:",
      maxTimeLimitForLock,
      srcTimeLimitForLock,
      dstTimeLimitForLock
    );
    if (limitTime > maxTimeLimitForLock) {
      throw new Error(
        `the "steptime" parameter in the lock action input does not meet expectations,limitTime:${limitTime}`
      );
    }
    if (
      !_.isFinite(limitTime) ||
      !_.isFinite(createTime) ||
      limitTime === 0 ||
      createTime === 0
    ) {
      throw new Error("incorrect lock time parameter");
    }
    const systemTime = new Date().getTime() / 1000;
    logger.info(
      systemTime,
      limitTime,
      createTime + limitTime,
      `systemTime>createTime + limitTime? ${systemTime > createTime + limitTime
      }`
    );
    if (systemTime > createTime + limitTime) {
      throw new Error(
        "failed to complete the operation within the specified time limit"
      );
    }
  }

  /**
   * Description Check whether the exchange amount can meet the basic balance of the wallet
   * @date 2023/2/8 - 21:05:33
   *
   * @private
   * @async
   * @param {AmmContext} ammContext "IEVENT_LOCK_QUOTE"
   * @returns {void} ""
   */
  private async verificationDexBalance(ammContext: AmmContext) {
    ammContext.swapInfo.dstAmount;
    const chainId = ammContext.baseInfo.dstChain.id;
    const dstTokenNumber: number = chainBalance.formatChainBalance(
      ammContext.swapInfo.dstAmount,
      ammContext.baseInfo.dstToken.precision
    );
    const dstNativeTokenNumber: number = chainBalance.formatChainBalance(
      ammContext.swapInfo.dstNativeAmount,
      ammContext.baseInfo.dstChain.nativeTokenPrecision
    );

    const dstTokenFree = await chainBalance.getFreeBalance(
      ammContext.quoteInfo.quote_hash,
      chainId,
      ammContext.walletInfo.walletName,
      ammContext.baseInfo.dstToken.address
    );
    const dstNativeTokenFree = await chainBalance.getFreeBalance(
      ammContext.quoteInfo.quote_hash,
      chainId,
      ammContext.walletInfo.walletName,
      "0x0"
    );
    if (dstTokenFree < dstTokenNumber) {
      logger.info("dstTokenFree < dstTokenNumber", dstTokenFree, dstTokenNumber);
      const errMsg =
        "Insufficient balance: The destination token balance is less than the required amount.";

      logger.error(errMsg);
      throw new Error(errMsg);
    }
    if (dstNativeTokenFree < dstNativeTokenNumber) {
      const errMsg =
        "Insufficient native token balance: The available native token balance is less than the required amount.";
      logger.error(errMsg);
      throw new Error(errMsg);
    }

    await chainBalanceLock.updateAndLock(
      ammContext.quoteInfo.quote_hash,
      ammContext.baseInfo.dstChain.id,
      ammContext.walletInfo.walletName,
      dataConfig.convertAddressToUniq(
        ammContext.baseInfo.dstToken.address,
        ammContext.baseInfo.dstChain.id
      ),
      "0",
      chainBalance.formatChainBalance(
        ammContext.swapInfo.dstAmount,
        ammContext.baseInfo.dstToken.precision
      ),
      chainBalance.formatChainBalance(
        ammContext.swapInfo.dstNativeAmount,
        ammContext.baseInfo.dstChain.nativeTokenPrecision
      ),
      ammContext.swapInfo.stepTimeLock
    );
  }

  /**
   * Description Verify whether the hash of the quotation appears in the historical quotation
   * the historical quotation will be saved for a period of time
   * @date 2/3/2023 - 4:10:25 PM
   * @public
   * @async
   * @param {AmmContext} ammContext "ammContext"
   * @param {IEVENT_LOCK_QUOTE} msg "msg"
   * @returns {*} "" throw error when error
   */
  public async verificationHistory(
    ammContext: AmmContext,
    msg: IEVENT_LOCK_QUOTE
  ) {
    const quoteHash: string = _.get(
      msg,
      "pre_business.swap_asset_information.quote.quote_base.quote_hash",
      ""
    );
    if (quoteHash !== "") {
      const ret = await quotationListHistory.getHistory(quoteHash);
      if (!ret) {
        throw new Error(`No historical quotes found,Hash:${quoteHash}}`);
      }
      logger.debug(ret);
    }
    // Temporary skip without hash
    return true;
  }

  public async verificationHedge(
    ammContext: AmmContext,
    msg: IEVENT_LOCK_QUOTE
  ): Promise<boolean> {
    if (!ammContext.hedgeEnabled) {
      return true;
    }
    const accountId = await ammContext.bridgeItem.hedge_info.getHedgeAccount();
    if (
      !(((await ammContext.bridgeItem.hedge_info
        .getHedgeIns()))
        .checkHedgeCond(ammContext))
    ) {
      logger.error(`Hedging conditions are not met，Unable to lock price.`);
      throw new Error(
        `Hedging conditions are not met，Unable to lock price，Insufficient hedging amount`
      );
    }
    if (
      !((await ammContext.bridgeItem.hedge_info
        .getHedgeIns())
        .preExecOrder(ammContext))
    ) {
      throw new Error(`preExecOrder error`);
    }
    logger.info("create lock result ");
    const balanceLockId = await (await ammContext.bridgeItem.hedge_info
      .getHedgeIns())
      .lockHedgeBalance(ammContext, accountId);
    _.set(
      msg,
      "pre_business.swap_asset_information.balance_lock_id",
      balanceLockId
    );
    return true;
  }

  private async createSystemOrder(
    ammContext: AmmContext,
    msg: IEVENT_LOCK_QUOTE
  ): Promise<[number, any]> {
    const config = this.getBridgeConfig(ammContext);
    const quoteHash: string = ammContext.quoteInfo.quote_hash;
    if (!quoteHash) {
      throw new Error(`No historical quotes found,Hash:${quoteHash}`);
    }
    const historyQuoteData = await quotationListHistory.getHistoryData(
      quoteHash
    );
    if (!historyQuoteData) {
      throw new Error(`No historical quotes found,Hash${historyQuoteData}`);
    }
    const [token0, token1] = [
      ammContext.baseInfo.srcToken.address,
      ammContext.baseInfo.dstToken.address,
    ];
    if (!token0 || !token1) {
      throw new Error(`Failed to create order, no token information found`);
    }
    const srcChainId = ammContext.baseInfo.srcToken.chainId;
    const dstChainId = ammContext.baseInfo.dstToken.chainId;
    const srcChainName = _.get(
      { chainName: dataConfig.getChainName(srcChainId) },
      "chainName",
      ""
    );
    const dstChainName = _.get(
      { chainName: dataConfig.getChainName(dstChainId) },
      "chainName",
      ""
    );
    const [token0Info, token1Info] = dataConfig.getCexStdSymbolInfoByToken(
      token0,
      token1,
      srcChainId,
      dstChainId
    );
    const systemOrder = CreateRecord();
    // Add basic information
    systemOrder.bridgeConfig = JSON.parse(stringify(config));
    systemOrder.balanceLockedId = _.get(
      msg,
      "pre_business.swap_asset_information.balance_lock_id",
      "0"
    );
    systemOrder.hash = quoteHash;
    systemOrder.baseInfo = {
      srcChain: {
        id: srcChainId,
        name: srcChainName,
      },
      dstChain: {
        id: dstChainId,
        name: dstChainName,
      },
      srcToken: {
        address: token0,
        symbol: _.get(token0Info, "symbol", ""),
        coinType: _.get(token0Info, "coinType", ""),
      },
      dstToken: {
        address: token1,
        symbol: _.get(token1Info, "symbol", ""),
        coinType: _.get(token1Info, "coinType", ""),
      },
    };
    systemOrder.quoteInfo = ammContext.quoteInfo;
    // var_dump(systemOrder);
    // const redisStore = new RedisStore("SYSTEM_ORDER");
    // const orderId = await redisStore.insertData(systemOrder, { hash: "1" });
    const idResult = await orderIncModule
      .findOneAndUpdate(
        {},
        { $inc: { inumber: 1 } },
        { upsert: true, returnDocument: "after" }
      )
      .lean();
    return [idResult.inumber, systemOrder];
  }

  private getBridgeConfig(ammContext: AmmContext): IBridgeTokenConfigItem {
    const srcToken = ammContext.baseInfo.srcToken.address;
    const dstToken = ammContext.baseInfo.dstToken.address;
    if (srcToken === "" || dstToken === "") {
      throw new Error(`Exchange currency pair information not found`);
    }
    const config: IBridgeTokenConfigItem = dataConfig.findItemByMsmqPath(
      ammContext.systemInfo.msmqName
    );
    if (!config) {
      throw new Error(
        `No cross-chain configuration found ${srcToken}/${dstToken}`
      );
    }
    return config;
  }

  /**
   * Description Reply Response Event
   * @date 1/18/2023 - 12:53:40 PM
   *
   * @public
   * @async
   * @param {IEVENT_LOCK_QUOTE} msg ""
   * @param {string} msmqName "channelName"
   * @returns {*} ""
   */
  public async response(
    msg: IEVENT_LOCK_QUOTE,
    msmqName: string
  ): Promise<void> {
    logger.debug(
      `🟦--> `,
      ILpCmd.CALLBACK_LOCK_QUOTE,
      _.get(msg, "pre_business.locked", "false")
    );
    await redisPub.publish(
      msmqName,
      JSON.stringify({
        cmd: ILpCmd.CALLBACK_LOCK_QUOTE,
        pre_business: msg.pre_business,
      })
    );
  }
}

const eventProcessLock: EventProcessLock = new EventProcessLock();
export { eventProcessLock };
