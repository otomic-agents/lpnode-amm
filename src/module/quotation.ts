/* eslint-disable valid-jsdoc */
/* eslint-disable arrow-parens */
/**
 *报价的第一版服务，还在填充逻辑中
 * **/
import {
  IBridgeTokenConfigItem,
  ICoinType,
  IHedgeType,
  ILpCmd,
} from "../interface/interface";
import { redisPub } from "../redis_bus";
import { logger } from "../sys_lib/logger";
import { orderbook } from "./orderbook";
import * as crypto from "crypto";
import BigNumber from "bignumber.js";
import { gas } from "./gas";
import { dataConfig } from "../data_config";
import * as _ from "lodash";
import { quotationListHistory } from "./quotation/quotation_history";
import { hedgeManager } from "./hedge_manager";
import {
  quotationPrice,
  QuotationPrice,
} from "./quotation/quotation_price_usdt";
import { AmmContext } from "../interface/context";
import { ammContextModule } from "../mongo_module/amm_context";
import { systemRedisBus } from "../system_redis_bus";

import { chainBalance } from "./chain_balance";
import { measure, memo } from "helpful-decorators";
import { IQuoteData } from "../interface/quotation";
import { EthUnit } from "../utils/eth";
import { SystemMath } from "../utils/system_math";
import { accountManager } from "./exchange/account_manager";
import { ConsoleDirDepth5 } from "../utils/console";

const { v4: uuidv4 } = require("uuid");

// @ts-ignore
const cTable = require("console.table");

class Quotation {
  private bridgeTokenList: IBridgeTokenConfigItem[] = []; // 桥跨链的报价
  private quotationPrice: QuotationPrice = new QuotationPrice();

  public async init() {
    systemRedisBus.on("bridgeUpdate", async () => {
      await dataConfig.syncBridgeConfigFromLocalDatabase();
      this.bridgeTokenList = dataConfig.getBridgeTokenList();
      logger.info(`更新报价程序中的bridge列表`, this.bridgeTokenList.length);
    });
    this.initStatus();
    this.bridgeTokenList = dataConfig.getBridgeTokenList();
    logger.debug(
      "Quotation program loading list completed",
      this.bridgeTokenList.length
    );
    this.startQuotation().then(() => {
      logger.info(`Start a timed quote`);
    });
  }

  private async startQuotation() {
    if (orderbook.spotOrderbookOnceLoaded === false) {
      logger.warn("spot orderbook 还没有初始化完毕,暂时不报价");
      return;
    }
    for (const item of this.bridgeTokenList) {
      this.quotationKeep(item).then(() => {
        //
      }); // 对单一个跨链进行报价
    }
    logger.info("完成了一次定时报价Keep", new Date().getTime());
    setTimeout(() => {
      this.startQuotation();
    }, 1000 * 30);
  }

  private getDefaultPriceStruct(): IQuoteData {
    return {
      origTotalPrice: "",
      usd_price: "", // 目标币的U价
      price: "", // return this.calculate(item, price);
      origPrice: "", // 币的原始报价，用于 之后计算滑点
      min_amount: "", // 如果想要够gas 消耗，最低的兑换数量,目前的算法是  假设设置消耗20Usd Gas ，那么 如果收取千三的手续费能满足Gas的情况下，最少需要多少个Atoken
      gas: `0`, // Gas 需要消耗多少个目标币，目前有Amount了，这里要重新算一下
      capacity: `0x${(50000000000000000000000).toString(16)}`, // 根据对冲配置，计算出来的最大量
      native_token_price: `0`, // 假设 ETH-USDT  BSC-AVAX  则价格为 ETH/AVAX
      native_token_usdt_price: `0`, // 目标链原生币的买价，orderbook卖5价
      native_token_max: `1`, // native_token_min * 10
      native_token_min: `0.1`, // 根据链配置的Gas币 最少Usd 单位，计算出的最小token币的兑换个数
      timestamp: new Date().getTime(),
      quote_hash: "",
    };
  }

  /**
   * 针对一行记录开始报价
   * @param {AmmContext} ammContext "对一个币对进行报价"
   * @returns {*} ""
   */
  public async quotationItem(ammContext: AmmContext): Promise<any> {
    const quoteHash = crypto.createHash("sha1").update(uuidv4()).digest("hex");
    const quoteInfo: { cmd: string; quote_data: IQuoteData } = {
      cmd: ILpCmd.CMD_UPDATE_QUOTE,
      quote_data: this.getDefaultPriceStruct(),
    };
    quoteInfo.quote_data.quote_hash = quoteHash;
    try {
      ammContext.quoteInfo.mode = this.getSwapType(ammContext);
      if (ammContext.hedgeEnabled) {
        const srcTokenPrice = quotationPrice.getSrcTokenBuyPrice(ammContext);
        const dstTokenPrice = quotationPrice.getDstTokenBuyPrice(ammContext);
        const hedgeIns = ammContext.bridgeItem.hedge_info.getHedgeIns();
        await hedgeIns.checkMinHedge(ammContext, srcTokenPrice, dstTokenPrice); // 初步的hedge检查 , 检查不换gas币的情况下，能否通过
        logger.info(`The cex order limit has been met`);
        await hedgeIns.checkSwapAmount(ammContext); // 余额和对冲额检查 ,CEX 有没有足够的量，卖出左侧，或者花费左侧币
      }
      this.process_quote_type(ammContext, quoteInfo); // 处理换币的模式 quote_orderbook_type
      this.price(ammContext, quoteInfo); //  origPrice price origTotalPrice usd_price mode
      this.price_src_token(ammContext, quoteInfo); // src_usd_price
      this.price_native_token(ammContext, quoteInfo); // native_token_usdt_price native_token_price  native_token_orig_price native_token_symbol
      await this.amount_check(ammContext); // format check
      this.renderInfo(ammContext, quoteInfo); // assetName assetTokenName assetChainInfo
      await this.min_amount(ammContext, quoteInfo); // min gas + min hedge check
      await this.calculate_capacity(ammContext, quoteInfo); // 计算最大量
      await this.native_token_min(ammContext, quoteInfo); // 计算目标链的Gas币兑换量 native_token_min
      await this.native_token_max(ammContext, quoteInfo); // native_token_max  目前是配置的，比如bsc上10笔交易Gas需要消耗的量
      this.calculate_gas(ammContext, quoteInfo); // 计算gas ，目前配置的最小交易量

      await this.analysis(ammContext, quoteInfo);
    } catch (e) {
      logger.error(e);
      return [undefined, undefined];
    }
    return [quoteHash, quoteInfo];
  }

  /**
   * 根据换的量，检查是否可报价，如果 Dex 余额不足则不报价
   * 如果对冲条件不满足，也不在报价,比如无法有余额去对冲
   * @date 2023/4/13 - 15:29:24
   *
   * @public
   * @async
   * @param {AmmContext} ammContext "context"
   * @returns {*} "输入量是否合法的检查"
   */
  public async amount_check(ammContext: AmmContext) {
    const inputNumberBN = new BigNumber(ammContext.swapInfo.inputAmountNumber)
      .toFixed()
      .toString();
    if (!_.isFinite(Number(inputNumberBN.toString()))) {
      throw new Error(`输入的量不合法:${ammContext.swapInfo.inputAmount}`);
    }
    return true;
  }

  public async quotationKeep(item: IBridgeTokenConfigItem) {
    if (!(await this.quotationPremise())) {
      logger.error(`不满足报价前提，暂不报价..`);
      return;
    }
    const quoteInfo = {
      cmd: ILpCmd.CMD_UPDATE_QUOTE,
      quote_data: {
        usd_price: "",
        src_usd_price: "",
        price: "",
        origPrice: "",
        min_amount: "",
        gas: `0`,
        capacity: `0x${(50000000000000000000000).toString(16)}`,
        native_token_price: `0`,
        native_token_max: `1`,
        native_token_min: `0.1`,
        timestamp: new Date().getTime(),
        quote_hash: "",
        msmq: item.msmq_name,
      },
    };
    // logger.debug(`send update quote to keep alive.${item.msmq_name}`);
    const quoteCmd = JSON.stringify(quoteInfo);
    redisPub.publish(item.msmq_name, quoteCmd).catch((e: any) => {
      logger.debug(`报价产生了错误`, e);
    });
  }

  public async quotationPremise() {
    if (orderbook.spotOrderbookOnceLoaded) {
      return true;
    }
    return false;
  }

  private process_quote_type(ammContext: AmmContext, sourceObject: any) {
    let quoteType = "SELL";
    if (ammContext.quoteInfo.mode === "11") {
      quoteType = "NULL";
    }
    if (ammContext.quoteInfo.mode === "ss") {
      quoteType = "NULL";
    }
    if (ammContext.quoteInfo.mode === "bs") {
      quoteType = "SELL";
    }
    if (ammContext.quoteInfo.mode === "sb") {
      quoteType = "BUY";
    }
    if (ammContext.quoteInfo.mode === "bb") {
      quoteType = "SELL";
    }
    Object.assign(sourceObject.quote_data, {
      quote_orderbook_type: quoteType,
    });
  }

  /**
   * @param {AmmContext} ammContext  币对配置
   * @param {*} sourceObject 的
   * @returns {void} ""
   */
  private async native_token_min(ammContext: AmmContext, sourceObject: any) {
    const gasSymbol = dataConfig.getChainTokenName(
      ammContext.baseInfo.dstToken.chainId
    );
    const gasTokenPrice = quotationPrice.getGasTokenBuyPrice(ammContext);
    let minHedgeCount = -1;
    if (dataConfig.getHedgeConfig().hedgeType !== IHedgeType.Null) {
      const accountIns = await accountManager.getAccount(
        dataConfig.getHedgeConfig().hedgeAccount
      );
      if (accountIns) {
        [minHedgeCount] = await accountIns.order.getSpotTradeMinMax(
          `${gasSymbol}/USDT`,
          gasTokenPrice
        );
        minHedgeCount = SystemMath.execNumber(`${minHedgeCount} * 200%`); // 向上浮动10% ，保证最小量
      }
    }
    const minCount = SystemMath.max([minHedgeCount]);

    Object.assign(sourceObject.quote_data, {
      native_token_min: new BigNumber(minCount).toString(),
    });
  }

  private async native_token_max(ammContext: AmmContext, sourceObject: any) {
    const dstChainId = ammContext.baseInfo.dstToken.chainId;

    let orderbookLiquidity = -1;
    if (dataConfig.getHedgeConfig().hedgeType !== IHedgeType.Null) {
      orderbookLiquidity =
        quotationPrice.getNativeTokenBuyLiquidity(dstChainId); // gas token都是购买，使用购买流动性即可
      logger.debug("GasToken 可以购买的最大流动性", orderbookLiquidity);
    }

    const nativeTokenPrice =
      this.quotationPrice.getNativeTokenBidPrice(dstChainId);
    const inputValueSwapGasCount = SystemMath.execNumber(
      `${ammContext.swapInfo.inputAmount}*${sourceObject.quote_data.src_usd_price}/${nativeTokenPrice}`,
      "实际输入的兑换价值可以兑换多少个GasToken?"
    );
    const maxSwapGasCount = SystemMath.execNumber(
      `${sourceObject.quote_data.capacity_num}*${sourceObject.quote_data.src_usd_price}/${nativeTokenPrice}`,
      "左侧输入的Usd价值，可以换多少个GasToken?"
    );
    logger.debug(
      "最大可换价值:",
      SystemMath.execNumber(
        `${sourceObject.quote_data.capacity_num}*${sourceObject.quote_data.src_usd_price}`
      ),
      "最大可以兑换为 * 个 GasToken",
      maxSwapGasCount
    );
    const tokenSymbol = dataConfig.getChainTokenName(
      ammContext.baseInfo.dstToken.chainId
    );
    const tokenStdSymbol = `${tokenSymbol}/USDT`;
    let minCexTradeCount = -1; // 至少这个最大值要满足 > hedge 的最小值
    let maxCexTradeCount = -1;
    if (dataConfig.getHedgeConfig().hedgeType !== IHedgeType.Null) {
      const accountIns = await accountManager.getAccount(
        dataConfig.getHedgeConfig().hedgeAccount
      );
      if (accountIns) {
        [minCexTradeCount, maxCexTradeCount] =
          await accountIns.order.getSpotTradeMinMax(
            tokenStdSymbol,
            nativeTokenPrice
          );
        minCexTradeCount = SystemMath.execNumber(`${minCexTradeCount} * 110%`); // 向上浮动10%
        maxCexTradeCount = SystemMath.execNumber(`${maxCexTradeCount} * 90%`); // 向下浮动10%
      }
    }
    const dstChainMaxSwapUsd = dataConfig.getChainGasTokenUsdMax(dstChainId);
    const maxCountBN = SystemMath.exec(
      // 配置中设置的Usd 最大允许交换多少个gasToken
      `${dstChainMaxSwapUsd} / ${nativeTokenPrice}`
    );
    if (!maxCountBN.isFinite()) {
      throw `计算目标链token最大报价发生错误 !isFinite`;
    }
    const maxCount = Number(maxCountBN.toFixed(8).toString());
    const nativeTokenBalance = chainBalance.getBalance(
      ammContext.baseInfo.dstChain.id,
      ammContext.walletInfo.walletName,
      "0x0"
    );
    let nativeTokenMax = SystemMath.min([
      SystemMath.execNumber(`${nativeTokenBalance}*70%`), // lp 目标链钱包中，有多少余额 ,留下30% 用来换币
      maxCexTradeCount, // trade 中最大能交易多少个gasToken
      maxCount, // 配置中最大能swap多少个gasToken
      inputValueSwapGasCount, // 输入的量中最多能满足多大的swap gasToken
      maxSwapGasCount, // 最大价值中能换取多少gasToken (受到对冲配置影响, 关闭时受余额影响，开启时，受Hedge模式影响)
      orderbookLiquidity, // orderbook 流动性能提供的最大swap 量 (level 5)
    ]);
    if (!_.isFinite(nativeTokenMax)) {
      logger.error(`Error in calculating the maximum amount of tokens`);
      nativeTokenMax = 0;
    }
    Object.assign(sourceObject.quote_data, {
      native_token_max: new BigNumber(nativeTokenMax).toFixed(8).toString(),
      native_token_max_number: Number(nativeTokenMax),
    });
    ammContext.quoteInfo = sourceObject.quote_data;
  }

  public async queryRealtimeQuote(ammContext: AmmContext): Promise<string> {
    await orderbook.refreshOrderbook(); // 立即刷新一次最新的orderbook ，然后计算价格
    const [price] = this.calculatePrice(ammContext, { quote_data: {} });
    return price;
  }

  @measure
  @memo()
  public async asksQuote(ammContext: AmmContext) {
    const [quoteHash, quoteInfo] = await this.quotationItem(ammContext); // 使用问价模式报价
    if (!_.isString(quoteHash)) {
      return;
    }
    _.set(quoteInfo, "cid", ammContext.AskInfo.cid);
    _.set(quoteInfo, "cmd", ILpCmd.EVENT_ASK_REPLY);
    const quoteCmd = JSON.stringify(quoteInfo);
    console.dir(quoteInfo.quote_data, { depth: null });
    logger.info(`send Message`, ammContext.systemInfo.msmqName, quoteInfo.cmd);
    redisPub
      .publish(ammContext.systemInfo.msmqName, quoteCmd)
      .catch((e: any) => {
        logger.debug(`publishing an offer message produced an error`, e);
      });
    const mode = _.clone(ammContext.quoteInfo.mode);
    ammContext.quoteInfo = quoteInfo.quote_data;
    ammContext.quoteInfo.mode = mode;
    quoteInfo.quote_data.inputAmount = ammContext.swapInfo.inputAmount;
    await ammContextModule.create(ammContext);
    await this.storeQuoteHistory(quoteHash, quoteInfo.quote_data);
  }

  /**
   * Description 计算报价
   * @date 1/31/2023 - 5:30:29 PM
   *
   * @private
   * @param {AmmContext} ammContext "报价的项"
   * @param {any} sourceObject "价格"
   * @returns {*} ""
   */
  public price(ammContext: AmmContext, sourceObject: any) {
    const { asks: dstTokenAsks } =
      this.quotationPrice.getCoinStableCoinOrderBook(
        ammContext.baseInfo.dstToken.address,
        ammContext.baseInfo.dstToken.chainId
      );

    const [[usdPrice]] = dstTokenAsks;
    if (usdPrice === 0) {
      logger.warn(
        `没有获取到dstToken/USDT,无法进行报价 ${ammContext.baseInfo.dstToken.symbol}/USDT`
      );
      throw new Error(
        `没有获取到dstToken/USDT,无法进行报价 ${ammContext.baseInfo.dstToken.symbol}/USDT`
      );
    }
    const [priceBn, origPrice, origTotalPriceBn] = this.calculatePrice(
      ammContext,
      sourceObject
    );
    ammContext.quoteInfo.price = priceBn.toString();
    Object.assign(sourceObject.quote_data, {
      origPrice,
      price: priceBn.toString(),
      origTotalPrice: origTotalPriceBn.toString(),
      usd_price: usdPrice, // 目标币的U价格  如 ETH-USDT   则 1  ETH-AVAX  则显示  Avax/Usdt的价格
    });
    sourceObject.quote_data.mode = ammContext.quoteInfo.mode;
    ammContext.quoteInfo = sourceObject.quote_data;
  }

  private price_native_token(ammContext: AmmContext, sourceObject: any) {
    const { asks: nativeTokenAsks } =
      this.quotationPrice.getCoinStableCoinOrderBookByCoinName(
        ammContext.baseInfo.dstChain.tokenName
      );
    const [[usdPrice]] = nativeTokenAsks;

    if (usdPrice === 0) {
      logger.warn(`没有获取到目标链，原生币的报价`);
      throw new Error(`没有获取到dstToken/USDT,无法进行报价`);
    }
    const gasSymbol = dataConfig.getChainTokenName(
      ammContext.baseInfo.dstChain.id
    );
    const nativeTokenPrice = quotationPrice.getGasTokenBuyPrice(ammContext);
    const srcTokenOrigPrice = _.get(
      sourceObject,
      "quote_data.src_usd_price",
      0
    );
    if (!_.isFinite(Number(srcTokenOrigPrice))) {
      logger.warn(`原始币的价格获取的不正确`);
      throw new Error(`原始币的价格获取的不正确`);
    }
    const targetPriceWithFee = SystemMath.exec(
      `${srcTokenOrigPrice}/${nativeTokenPrice}*(1-${ammContext.baseInfo.fee})`
    );
    const targetPrice = SystemMath.exec(
      `${srcTokenOrigPrice}/${nativeTokenPrice}`
    );

    Object.assign(sourceObject.quote_data, {
      native_token_price: targetPriceWithFee.toString(), // ETH-USDT 到BSC  则是 ETH/BNB的价格
      native_token_orig_price: targetPrice.toString(),
      native_token_symbol: `${gasSymbol}/USDT`,
      native_token_usdt_price: new BigNumber(usdPrice).toString(),
    });
  }

  private price_src_token(ammContext: AmmContext, sourceObject: any) {
    const { bids: srcTokenBids } =
      this.quotationPrice.getCoinStableCoinOrderBookByCoinName(
        ammContext.baseInfo.srcToken.symbol
      );
    const [[price]] = srcTokenBids;

    if (price === 0) {
      logger.warn(`没有获得源链,币的Usdt报价`);
      throw new Error(`没有获得源链,币的Usdt报价`);
    }

    Object.assign(sourceObject.quote_data, {
      src_usd_price: new BigNumber(price).toString(),
    });
    ammContext.quoteInfo = sourceObject.quote_data;
  }

  private getSwapType(ammContext: AmmContext) {
    const srcSymbol = ammContext.baseInfo.srcToken.symbol;
    const srcCoinType = ammContext.baseInfo.srcToken.coinType;
    const dstSymbol = ammContext.baseInfo.dstToken.symbol;
    const dstCoinType = ammContext.baseInfo.dstToken.coinType;

    if (!srcSymbol || !dstSymbol) {
      logger.error(`没有找到币对的基本信息`);
      throw new Error("没有找到币对的基本信息");
    }
    if (
      srcCoinType === ICoinType.StableCoin &&
      dstCoinType === ICoinType.StableCoin
    ) {
      // 这个ss要放在最前面
      return "ss";
    }
    if (
      srcSymbol === dstSymbol &&
      srcCoinType !== ICoinType.StableCoin &&
      dstCoinType !== ICoinType.StableCoin
    ) {
      return "11";
    }
    if (srcCoinType === ICoinType.Coin && dstCoinType === ICoinType.Coin) {
      return "bb";
    }

    if (
      srcCoinType === ICoinType.StableCoin &&
      dstCoinType === ICoinType.Coin
    ) {
      return "sb";
    }
    if (
      srcCoinType === ICoinType.Coin &&
      dstCoinType === ICoinType.StableCoin
    ) {
      return "bs";
    }
    throw "未适配的工作类型";
  }

  private calculatePrice_bb(
    ammContext: AmmContext,
    sourceObject: any = undefined
  ): [string, string, string] {
    // ETH/AVAX
    const srcTokenPrice = this.quotationPrice.getCoinStableCoinOrderBook(
      ammContext.baseInfo.srcToken.address,
      ammContext.baseInfo.srcToken.chainId
    );
    const dstTokenPrice = this.quotationPrice.getCoinStableCoinOrderBook(
      ammContext.baseInfo.dstToken.address,
      ammContext.baseInfo.dstToken.chainId
    );
    const priceBn = this.quotationPrice.getABPrice(
      new BigNumber(1),
      srcTokenPrice,
      dstTokenPrice
    );
    const withFee = 1 - ammContext.baseInfo.fee;
    const targetPriceBN = priceBn.times(new BigNumber(withFee));
    Object.assign(sourceObject.quote_data, {
      orderbook: {
        A: srcTokenPrice,
        B: dstTokenPrice,
      },
    });
    const totalOrigPrice = new BigNumber(
      ammContext.swapInfo.inputAmountNumber
    ).times(new BigNumber(priceBn));
    return [
      targetPriceBN.toString(),
      priceBn.toString(),
      totalOrigPrice.toString(),
    ];
  }

  /**
   * Description placeholder
   * @date 2023/4/13 - 16:29:37
   * ETH-USDT
   * 报左侧的卖价 orderbook eth-usdt bids 均价
   * @private
   * @param {AmmContext} ammContext "context"
   * @param {*} [sourceObject=undefined] "需要assign的对象"
   * @returns {[string, string, string]} ""
   */
  private calculatePrice_bs(
    ammContext: AmmContext,
    sourceObject: any = undefined
  ): [string, string, string] {
    let quoteOrderbookType = "getCoinStableCoinOrderBook";
    if (ammContext.hedgeEnabled) {
      quoteOrderbookType = "getCoinStableCoinExecuteOrderbook";
    }
    const { stdSymbol, bids, asks, timestamp } = this.quotationPrice[
      quoteOrderbookType
    ](
      ammContext.baseInfo.srcToken.address,
      ammContext.baseInfo.srcToken.chainId,
      ammContext.swapInfo.inputAmountNumber
    );
    if (stdSymbol === null) {
      logger.error(`获取orderbook失败无法计算价格`, "calculatePrice_bs");
      throw "获取orderbook失败无法计算价格";
    }
    logger.info("get orderbook ", stdSymbol);
    const [[price]] = bids;

    Object.assign(sourceObject.quote_data, {
      orderbook: {
        A: { bids, asks, timestamp },
        B: null,
      },
    });
    return [
      SystemMath.exec(`${price} * (1 - ${ammContext.baseInfo.fee})`).toString(),
      SystemMath.exec(`1* ${price}`).toString(),
      SystemMath.exec(
        `${ammContext.swapInfo.inputAmountNumber} * ${price}`
      ).toString(),
    ];
  }

  private calculatePrice_ss(
    ammContext: AmmContext,
    sourceObject: any = undefined
  ): [string, string, string] {
    // return { stdSymbol: null, bids: [[0, 0]], asks: [[0, 0]] };
    // ETH/USDT

    const priceBn = new BigNumber(1);
    const withFee = 1 - ammContext.baseInfo.fee;
    const targetPriceBN = priceBn.times(new BigNumber(withFee));
    Object.assign(sourceObject.quote_data, {
      orderbook: {},
    });
    const totalOrigPrice = new BigNumber(
      ammContext.swapInfo.inputAmountNumber
    ).times(new BigNumber(priceBn));
    return [
      targetPriceBN.toString(),
      priceBn.toString(),
      totalOrigPrice.toString(),
    ];
  }

  private calculatePrice_11(
    ammContext: AmmContext,
    sourceObject: any = undefined
  ): [string, string, string] {
    const priceBn = new BigNumber(1);
    const withFee = 1 - ammContext.baseInfo.fee;
    const targetPriceBN = priceBn.times(new BigNumber(withFee));
    Object.assign(sourceObject.quote_data, {
      orderbook: {},
    });
    const totalOrigPrice = new BigNumber(
      ammContext.swapInfo.inputAmountNumber
    ).times(new BigNumber(priceBn));
    return [
      targetPriceBN.toString(),
      priceBn.toString(),
      totalOrigPrice.toString(),
    ];
  }

  private calculatePrice_sb(
    ammContext: AmmContext,
    sourceObject: any = undefined
  ): [string, string, string] {
    // return { stdSymbol: null, bids: [[0, 0]], asks: [[0, 0]] };
    // ETH/USDT
    const { stdSymbol, bids, asks, timestamp } =
      this.quotationPrice.getCoinStableCoinOrderBook(
        ammContext.baseInfo.dstToken.address,
        ammContext.baseInfo.dstToken.chainId
      );
    if (stdSymbol === null) {
      logger.error(`获取orderbook失败无法计算价格`, "calculatePrice_bs");
      throw "获取orderbook失败无法计算价格";
    }

    const [[price]] = asks;
    const priceBn = new BigNumber(1).div(new BigNumber(price));
    const withFee = 1 - ammContext.baseInfo.fee;
    const targetPriceBN = priceBn.times(new BigNumber(withFee));
    Object.assign(sourceObject.quote_data, {
      orderbook: {
        A: null,
        B: { bids, asks, timestamp },
      },
    });
    const totalOrigPrice = new BigNumber(
      ammContext.swapInfo.inputAmountNumber
    ).times(new BigNumber(priceBn));
    return [
      targetPriceBN.toFixed(8).toString(),
      SystemMath.exec(`1/${price}`).toFixed(8).toString(),
      totalOrigPrice.toString(),
    ];
  }

  private calculatePrice(
    ammContext: AmmContext,
    sourceObject: any = undefined
  ): [string, string, string] {
    const swapType = this.getSwapType(ammContext);
    logger.info(`当前的swapType`, swapType);
    if (swapType === "bb") {
      // ETH-AVAX
      ammContext.quoteInfo.mode = "bb";
      Object.assign(sourceObject.quote_data, { mode: "bb" });
      return this.calculatePrice_bb(ammContext, sourceObject);
    }
    if (swapType === "bs") {
      // ETH-USDT
      ammContext.quoteInfo.mode = "bs";
      Object.assign(sourceObject.quote_data, { mode: "bs" });
      return this.calculatePrice_bs(ammContext, sourceObject);
    }
    if (swapType === "ss") {
      ammContext.quoteInfo.mode = "ss";
      Object.assign(sourceObject.quote_data, { mode: "ss" });
      return this.calculatePrice_ss(ammContext, sourceObject);
    }
    if (swapType === "11") {
      ammContext.quoteInfo.mode = "11";
      Object.assign(sourceObject.quote_data, { mode: "11" });
      return this.calculatePrice_11(ammContext, sourceObject);
    }
    if (swapType === "sb") {
      ammContext.quoteInfo.mode = "sb";
      Object.assign(sourceObject.quote_data, { mode: "sb" });
      return this.calculatePrice_sb(ammContext, sourceObject);
    }
    throw new Error("没有实现的交换");
  }

  private async min_amount(ammContext: AmmContext, sourceObject: any) {
    let minHedgeInputNumber = -1;
    const srcTokenPrice = quotationPrice.getSrcTokenBuyPrice(ammContext);
    if (dataConfig.getHedgeConfig().hedgeType !== IHedgeType.Null) {
      const dstTokenPrice = quotationPrice.getDstTokenSellPrice(ammContext);
      const gasTokenPrice = quotationPrice.getGasTokenBuyPrice(ammContext);
      minHedgeInputNumber = await hedgeManager
        .getHedgeIns(dataConfig.getHedgeConfig().hedgeType)
        .getMinHedgeAmount(
          ammContext,
          srcTokenPrice,
          dstTokenPrice,
          gasTokenPrice
        );
    }
    const configConvertInput = SystemMath.execNumber(
      `20/${srcTokenPrice}*100.3%`
    );
    const minAmount = SystemMath.max([configConvertInput, minHedgeInputNumber]);
    if (minAmount === undefined) {
      throw new Error("Minimum volume calculation error");
    }
    Object.assign(sourceObject.quote_data, {
      min_amount: new BigNumber(minAmount).toString(),
    });
  }

  /**
   * Description 计算gas 消耗多少个币
   * @date 1/17/2023 - 9:16:44 PM
   * 这里需要把 dstToken 换成U 的价格，根据币的行情来换算 比如兑换USDT，则20刀需要多少个USDT
   * @private
   * @param {AmmContext} ammContext address
   * @param {*} sourceObject quoteinfo
   * @returns {*} void
   */
  private calculate_gas(ammContext: AmmContext, sourceObject: any) {
    // 获取目标币的U价格
    const { bids: bid } = this.quotationPrice.getCoinStableCoinOrderBook(
      ammContext.baseInfo.dstToken.address,
      ammContext.baseInfo.dstToken.chainId
    );
    const [[usdPrice]] = bid;
    if (usdPrice === 0) {
      return "0";
    }
    // 需要扣除的币个数
    const coinCount = new BigNumber(gas.getGasUsd()).div(
      new BigNumber(usdPrice)
    );

    Object.assign(sourceObject.quote_data, {
      gas: coinCount.toFixed(8).toString(),
      gas_usd: gas.getGasUsd(),
    });
  }

  private renderInfo(ammContext: AmmContext, sourceObject: any) {
    const [{ symbol: token0 }, { symbol: token1 }] =
      dataConfig.getCexStdSymbolInfoByToken(
        ammContext.baseInfo.srcToken.address,
        ammContext.baseInfo.dstToken.address,
        ammContext.baseInfo.srcToken.chainId,
        ammContext.baseInfo.dstToken.chainId
      );
    logger.debug(token0, token1);
    Object.assign(sourceObject.quote_data, {
      assetName: `${token0}/${token1}`,
      assetTokenName: `${ammContext.baseInfo.srcToken.address}/${ammContext.baseInfo.dstToken.address}`,
      assetChainInfo: `${ammContext.baseInfo.srcToken.chainId}-${ammContext.baseInfo.dstToken.chainId}`,
    });
  }

  /**
   * Description 计算能够兑换的最大量
   * @date 2023/2/27 - 13:43:34
   *
   * @private
   * @async
   * @param {AmmContext} ammContext "当前报价配置"
   * @param {*} sourceObject "报价对象"
   * @returns {*} ""
   */
  private async calculate_capacity(ammContext: AmmContext, sourceObject: any) {
    let hedgeCapacity = -1;
    const orderbookLiquidity = await this.calculateLiquidity(ammContext);
    const dstBalanceMaxSwap = await this.dstBalanceMaxSwap(ammContext);
    if (dataConfig.getHedgeConfig().hedgeType !== IHedgeType.Null) {
      hedgeCapacity = await hedgeManager
        .getHedgeIns(dataConfig.getHedgeConfig().hedgeType)
        .calculateCapacity(ammContext);
    }

    const capacity = SystemMath.min([
      hedgeCapacity,
      dstBalanceMaxSwap,
      orderbookLiquidity,
    ]);
    logger.info(
      hedgeCapacity,
      dstBalanceMaxSwap,
      orderbookLiquidity,
      "<-hedgeCapacity"
    );

    logger.debug(
      hedgeCapacity,
      dstBalanceMaxSwap,
      "⏩⏩⏩⏩⏩⏩⏩⏩⏩",
      capacity
    );
    logger.debug(
      `最大价格应该报价为`,
      new BigNumber(capacity).toFixed(8).toString()
    );
    const etherWei = EthUnit.toWei(
      capacity.toString(),
      ammContext.baseInfo.srcToken.precision
    );
    _.assign(sourceObject.quote_data, {
      capacity_num: new BigNumber(capacity).toFixed(8).toString(),
      capacity: `0x${etherWei}`,
    });
  }

  private async calculateLiquidity(ammContext: AmmContext): Promise<number> {
    let leftSymbol = "";
    if (ammContext.quoteInfo.mode === "11") {
      leftSymbol = ammContext.baseInfo.srcToken.symbol;
    }
    if (ammContext.quoteInfo.mode === "ss") {
      leftSymbol = dataConfig.getChainTokenName(
        ammContext.baseInfo.dstChain.id
      );
    }
    if (ammContext.quoteInfo.mode === "bs") {
      leftSymbol = ammContext.baseInfo.srcToken.symbol;
    }
    if (ammContext.quoteInfo.mode === "sb") {
      leftSymbol = ammContext.baseInfo.dstToken.symbol;
    }
    if (ammContext.quoteInfo.mode === "bb") {
      leftSymbol = ammContext.baseInfo.srcToken.symbol;
    }
    if (leftSymbol === "") {
      throw new Error(`未知的兑换模式`);
    }
    const { bids } =
      quotationPrice.getCoinStableCoinOrderBookLiquidityByCoinName(leftSymbol);
    let bidPrice = bids;
    if (ammContext.quoteInfo.mode === "sb") {
      bidPrice = SystemMath.execNumber(
        `${bids}* ${ammContext.quoteInfo.usd_price}`
      );
      logger.info(
        `Orderbook ${bids} 个${ammContext.baseInfo.dstToken.symbol} 可以提供【${ammContext.baseInfo.srcToken.symbol}】流动性${bidPrice}`
      );
    }
    if (ammContext.quoteInfo.mode === "ss") {
      bidPrice = SystemMath.execNumber(
        `${bids}* ${ammContext.quoteInfo.native_token_usdt_price}/${ammContext.quoteInfo.src_usd_price}`
      );
      logger.info(
        `Orderbook ${bids} 个${ammContext.baseInfo.dstChain.tokenName} 可以提供【${ammContext.baseInfo.srcToken.symbol}】流动性${bidPrice}`
      );
    }
    if (ammContext.quoteInfo.mode === "11") {
      // 应该是左侧卖的流动性 和右侧买的流动性最小值  ,暂时使用左侧卖的流动性  orderbook bids
    }
    if (ammContext.quoteInfo.mode === "bs") {
      // 左侧流动性，没有问题
    }
    if (ammContext.quoteInfo.mode === "bb") {
      // 应该是左侧卖流动性  右侧买流动性的最小值 ,,暂时使用左侧卖的流动性  orderbook bids
    }

    return bidPrice;
  }

  /**
   * 目标链余额swap的最大
   * @param ammContext
   * @private
   */
  private async dstBalanceMaxSwap(ammContext: AmmContext): Promise<number> {
    const dstTokenBalance = chainBalance.getBalance(
      ammContext.baseInfo.dstToken.chainId,
      ammContext.walletInfo.walletName,
      ammContext.baseInfo.dstToken.address
    );
    const {
      asks: [[dstTokenPrice]],
    } = quotationPrice.getCoinStableCoinOrderBook(
      ammContext.baseInfo.dstToken.address,
      ammContext.baseInfo.dstToken.chainId
    );
    const {
      asks: [[srcTokenPrice]],
    } = quotationPrice.getCoinStableCoinOrderBook(
      ammContext.baseInfo.srcToken.address,
      ammContext.baseInfo.srcToken.chainId
    );
    const dstTokenUsdtPriceBN = new BigNumber(dstTokenPrice).times(
      new BigNumber(dstTokenBalance)
    ); // dstToken USDT价值
    const dstTokenDexBalanceToSrcTokenCount = dstTokenUsdtPriceBN
      .div(srcTokenPrice)
      .toFixed(8)
      .toString(); // 目标币的Dex 余额，能换多少个SrcToken
    logger.info(
      `目标DstChain: [${ammContext.baseInfo.dstToken.chainId}] [${ammContext.baseInfo.dstToken.symbol}],余额[${dstTokenBalance}]可提供，SrcToken[${ammContext.baseInfo.srcToken.symbol}] Max Input:${dstTokenDexBalanceToSrcTokenCount}`
    );
    const dstTokenDexBalanceToSrcTokenCountNumber = Number(
      dstTokenDexBalanceToSrcTokenCount
    );
    return dstTokenDexBalanceToSrcTokenCountNumber;
  }
  /**
   * 分析价格是否有效
   * @param ammContext
   * @param sourceObject
   */
  private async analysis(ammContext: AmmContext, sourceObject: any) {
    const max = _.get(sourceObject, "quote_data.capacity_num", 0);
    const min = _.get(sourceObject, "quote_data.min_amount", 0);
    const input = ammContext.swapInfo.inputAmountNumber;
    if (input < min) {
      console.dir(sourceObject.quote_data, ConsoleDirDepth5);
      logger.warn("The amount of input is too small");
      throw new Error(`The amount of input is too small`);
    }
    if (max <= input) {
      console.dir(sourceObject.quote_data, ConsoleDirDepth5);
      logger.warn(
        "The quotation has expired, and the maximum quantity is not enough to meet the input requirement."
      );
      throw new Error(
        `The quotation has expired, and the maximum quantity is not enough to meet the input requirement`
      );
    }
  }

  // @ts-ignore
  private async storeQuoteHistory(quoteHash: string, data: any) {
    await quotationListHistory.store(quoteHash, data);
  }
  private initStatus() {
    //
  }
}

const quotation: Quotation = new Quotation();
export { quotation };
