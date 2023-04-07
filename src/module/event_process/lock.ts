import _ from "lodash";
import { IEVENT_LOCK_QUOTE } from "../../interface/event";
import { logger } from "../../sys_lib/logger";

import { redisPub } from "../../redis_bus";
import {
  IBridgeTokenConfigItem,
  IHedgeType,
  ILpCmd,
} from "../../interface/interface";
import { dataConfig } from "../../data_config";
import { quotation } from "../quotation";
import BigNumber from "bignumber.js";
import { quotationListHistory } from "../quotation/quotation_history";
import { hedgeManager } from "../hedge_manager";
import { BaseEventProcess } from "./base_event_process";
import { CreateRecord } from "./system_record";
import { ammContextModule } from "../../mongo_module/amm_context";
import { AmmContext } from "../../interface/context";
import { orderIncModule } from "../../mongo_module/order_inc";

const var_dump = require("var_dump");

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
        return [false, `时间过期:${awaytime / 100}Sec`];
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

  public async process(msg: IEVENT_LOCK_QUOTE): Promise<void> {
    const ammContext: AmmContext = await ammContextModule
      .findOne({
        "quoteInfo.quote_hash": _.get(
          msg,
          "pre_business.swap_asset_information.quote.quote_base.quote_hash",
          "",
        ),
      })
      .lean();
    if (!ammContext) {
      throw new Error(`No historical inquiry found`);
    }
    if (_.get(ammContext, "lockInfo.time", 0) > 0) {
      throw new Error("It is not possible to lock the same quote repeatedly");
    }
    ammContext.swapInfo.srcAmount = _.get(
      msg,
      "pre_business.swap_asset_information.amount",
      "",
    );
    let systemOrder;
    let orderId;
    try {
      await this.runVerificationEngine(msg); // Validate data
      await this.verificationDexBalance(ammContext); // Check Des balance
      await this.verificationHistory(ammContext, msg); // Check history quote
      await this.checkSpread(ammContext, msg); // Check spread
      await this.verificationHedge(ammContext, msg); // Verify that hedging is possible
      [orderId, systemOrder] = await this.createSystemOrder(ammContext, msg); // Create system order
      _.set(
        msg,
        "pre_business.order_append_data",
        JSON.stringify({
          orderId,
        }),
      ); // 把orderId返回
      _.set(msg, "pre_business.locked", true);
      _.set(msg, "pre_business.err_msg", "");
      logger.info(`new orderId:${orderId}`);
    } catch (e) {
      const err: any = e;
      logger.error(`lock has been rejected Error:${err.toString()}`);
      _.set(msg, "pre_business.order_append_data", JSON.stringify({}));
      _.set(msg, "pre_business.locked", false);
      _.set(msg, "pre_business.err_msg", err.toString());
    } finally {
      await this.response(msg, ammContext.systemInfo.msmqName);
    }
    _.set(systemOrder, "orderId", orderId);

    await ammContextModule.updateOne(
      {
        "quoteInfo.quote_hash": _.get(
          msg,
          "pre_business.swap_asset_information.quote.quote_base.quote_hash",
          "",
        ),
      },
      {
        $set: {
          step: 1, // 标记已经处于lock状态
          systemOrder,
          "lockInfo.time": new Date().getTime(),
          "lockInfo.price": ammContext.quoteInfo.origPrice,
          "lockInfo.nativeTokenPrice": ammContext.quoteInfo.native_token_usdt_price,
          "lockInfo.dstTokenPrice": ammContext.quoteInfo.usd_price,
          "lockInfo.srcTokenPrice": ammContext.quoteInfo.src_usd_price
        },
      },
    );
  }

  /**
   * Description Check the price difference between Quote and Lock
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
      undefined,
    );
    if (!historyPrice) {
      logger.warn(
        `An error occurred while obtaining the locked price,The original value is:`,
        _.get(msg, "pre_business.swap_asset_information.quote.quote_base.price"),
      );
      throw new Error(`can't fand locked price`);
    }
    const historyBN = new BigNumber(historyPrice);
    const curBN = new BigNumber(curPrice);
    const spreadBN = historyBN.minus(curBN).div(historyBN);
    const spread = spreadBN.toString();
    logger.info(`当前的锁定价差是:${spread}`);

    logger.info(`Lock quote spread ${spread.toString()}`);
    if (spreadBN.gt(new BigNumber(0.003))) {
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
    msg: IEVENT_LOCK_QUOTE,
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
    return true;
    //
  }

  /**
   * Description Verify whether the hash of the quotation appears in the historical quotation
   * the historical quotation will be saved for a period of time
   * @date 2/3/2023 - 4:10:25 PM
   * @todo 协调加上hash
   * @public
   * @async
   * @param {AmmContext} ammContext "ammContext"
   * @param {IEVENT_LOCK_QUOTE} msg "msg"
   * @returns {*} "" 失败时直接抛出异常
   */
  public async verificationHistory(
    ammContext: AmmContext,
    msg: IEVENT_LOCK_QUOTE,
  ) {
    const quoteHash: string = _.get(
      msg,
      "pre_business.swap_asset_information.quote.quote_base.quote_hash",
      "",
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
    msg: IEVENT_LOCK_QUOTE,
  ): Promise<boolean> {
    const hedgeType = dataConfig.getHedgeConfig().hedgeType;
    const accountId = dataConfig.getHedgeConfig().hedgeAccount;
    if (hedgeType === IHedgeType.Null) {
      return true;
    }
    if (
      !(await hedgeManager.getHedgeIns(hedgeType)
        .checkHedgeCond(ammContext))
    ) {
      logger.error(`Hedging conditions are not met，Unable to lock price.`);
      throw new Error(
        `Hedging conditions are not met，Unable to lock price，Insufficient hedging amount`,
      );
    }
    logger.info("create lock result ");
    const balanceLockId = await hedgeManager
      .getHedgeIns(hedgeType)
      .lockHedgeBalance(ammContext, accountId);
    _.set(
      msg,
      "pre_business.swap_asset_information.balance_lock_id",
      balanceLockId,
    );
    return true;
  }

  private async createSystemOrder(
    ammContext: AmmContext,
    msg: IEVENT_LOCK_QUOTE,
  ): Promise<[number, any]> {
    const config = this.getBridgeConfig(ammContext);
    const quoteHash: string = ammContext.quoteInfo.quote_hash;
    if (!quoteHash) {
      throw new Error(`No historical quotes found,Hash:${quoteHash}`);
    }
    const historyQuoteData = await quotationListHistory.getHistoryData(
      quoteHash,
    );
    if (!historyQuoteData) {
      throw new Error(`No historical quotes found,Hash${historyQuoteData}`);
    }
    const historyQuoteInfo = JSON.parse(historyQuoteData);
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
      "",
    );
    const dstChainName = _.get(
      { chainName: dataConfig.getChainName(dstChainId) },
      "chainName",
      "",
    );
    const [token0Info, token1Info] = dataConfig.getCexStdSymbolInfoByToken(
      token0,
      token1,
      srcChainId,
      dstChainId,
    );
    const systemOrder = CreateRecord();
    // Add basic information
    systemOrder.bridgeConfig = config;
    systemOrder.balanceLockedId = _.get(
      msg,
      "pre_business.swap_asset_information.balance_lock_id",
      0,
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
    systemOrder.quoteInfo = {
      amount: `0`, // 没有改成websocket之前，是0
      quoteHash,
      price: _.get(historyQuoteInfo, "price", ""),
      capacity: _.get(historyQuoteInfo, "capacity", ""),
      nativeTokenPrice: _.get(historyQuoteInfo, "native_token_price", ""),
    };
    var_dump(systemOrder);
    // const redisStore = new RedisStore("SYSTEM_ORDER");
    // const orderId = await redisStore.insertData(systemOrder, { hash: "1" });
    const idResult = await orderIncModule
      .findOneAndUpdate(
        {},
        { $inc: { inumber: 1 } },
        { upsert: true, returnDocument: "after" },
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
    const config: IBridgeTokenConfigItem =
      dataConfig.findItemByMsmqName(ammContext.systemInfo.msmqName);
    if (!config) {
      throw new Error(
        `No cross-chain configuration found ${srcToken}/${dstToken}`,
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
    msmqName: string,
  ): Promise<void> {
    logger.debug(
      `🟦--> `,
      ILpCmd.CALLBACK_LOCK_QUOTE,
      _.get(msg, "pre_business.locked", "false"),
    );
    await redisPub.publish(
      msmqName,
      JSON.stringify({
        cmd: ILpCmd.CALLBACK_LOCK_QUOTE,
        pre_business: msg.pre_business,
      }),
    );
  }
}

const eventProcessLock: EventProcessLock = new EventProcessLock();
export { eventProcessLock };
