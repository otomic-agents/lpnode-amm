/* eslint-disable valid-jsdoc */
/* eslint-disable arrow-parens */
import {
  EFlowStatus,
  IBridgeTokenConfigItem,
  ICoinType,
  ILpCmd,
} from "../interface/interface";
const dayjs = require("dayjs");
import axios from 'axios';
import stringify from 'json-stringify-safe';
import { redisPub } from "../redis_bus";
import { logger } from "../sys_lib/logger";
import { orderbook } from "./orderbook/orderbook";
import * as crypto from "crypto";
import BigNumber from "bignumber.js";
import { dataConfig } from "../data_config";
import * as _ from "lodash";
import * as mathlib from "mathjs";
import { quotationListHistory } from "./quotation/quotation_history";

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
import { ConsoleDirDepth5 } from "../utils/console";
import { SystemError, SystemErrorDict } from "./system_error";
import { statusReport } from "../status_report";

const { v4: uuidv4 } = require("uuid");

// @ts-ignore
const cTable = require("console.table");

class Quotation {
  private bridgeTokenList: IBridgeTokenConfigItem[] = [];
  private quotationPrice: QuotationPrice = new QuotationPrice();

  public async init() {
    systemRedisBus.on("bridgeUpdate", async () => {
      await dataConfig.syncBridgeConfigFromLocalDatabase();
      this.bridgeTokenList = dataConfig.getBridgeTokenList();
      logger.info(
        `Update the list of bridges in the quote program`,
        this.bridgeTokenList.length
      );
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
    const keepList: string[] = [];
    for (const item of this.bridgeTokenList) {
      keepList.push(item.std_symbol);
      this.quotationKeep(item).then(() => {
        //
      });
    }
    logger.info(
      "keep quotation",
      keepList.join(","),
      dayjs().format("YYYY-MM-DDTHH:mm:ss SSS [Z] A")
    );
    setTimeout(() => {
      this.startQuotation();
    }, 1000 * 30);
  }

  private getDefaultPriceStruct(): IQuoteData {
    return {
      origTotalPrice: "",
      price: "", // return this.calculate(item, price);
      origPrice: "", // The original quotation of the currency, which is used to calculate the slippage after
      dst_usd_price: "", // dstToken/StableCoin
      min_amount: "", // Minimum required input
      gas: `0`,
      capacity: `0x${(50000000000000000000000).toString(16)}`, // The maximum supply that the system can provide
      native_token_price: `0`, // srcToken/TargetChain Coin Price
      native_token_usdt_price: `0`, // TargetChain Coin Price/USDT
      native_token_max: `0`, // native_token maximum exchange amount
      native_token_min: `0`, // minimum exchange amount
      timestamp: new Date().getTime(), // Time quotes
      quote_hash: "", // Quotation unique hash
    };
  }

  public async getFailedQuoteInfo(ammContext: AmmContext):Promise<any>{
    const quoteHash = crypto.createHash("sha1").update(uuidv4()).digest("hex");
    const quoteInfo: { cmd: string; quote_data: IQuoteData } = {
      cmd: ILpCmd.CMD_UPDATE_QUOTE,
      quote_data: this.getDefaultPriceStruct(),
    };
    quoteInfo.quote_data.quote_hash = quoteHash;
    return quoteInfo;
  }
  /**
   *
   * @param {AmmContext} ammContext ""
   * @returns {*} ""
   */
  public async quotationItem(ammContext: AmmContext): Promise<any> {
    const quoteHash = crypto.createHash("sha1").update(uuidv4()).digest("hex");
    const quoteInfo: { cmd: string; quote_data: IQuoteData } = {
      cmd: ILpCmd.CMD_UPDATE_QUOTE,
      quote_data: this.getDefaultPriceStruct(),
    };
    quoteInfo.quote_data.quote_hash = quoteHash;
    await orderbook.refreshOrderbook();
    try {
      ammContext.quoteInfo.mode = this.getSwapType(ammContext);
      if (ammContext.hedgeEnabled) {
        const srcTokenPrice = quotationPrice.getSrcTokenBuyPrice(ammContext);
        const dstTokenPrice = quotationPrice.getDstTokenBuyPrice(ammContext);
        const hedgeIns = ammContext.bridgeItem.hedge_info.getHedgeIns();
        await hedgeIns.checkMinHedge(ammContext, srcTokenPrice, dstTokenPrice);
        logger.info(`The cex order limit has been met`);
        await hedgeIns.checkSwapAmount(ammContext); // Check the balance and hedging amount, whether there is enough amount in CEX, sell the left side, or spend the left side currency
      }
      // sync quote
      this.process_quote_type(ammContext, quoteInfo); //  quote_orderbook_type
      this.price_src_token(ammContext, quoteInfo); // src_usd_price
      this.price_dst_token(ammContext, quoteInfo);
      await this.price(ammContext, quoteInfo); //  origPrice price origTotalPrice dst_usd_price mode
      this.price_hedge_fee_price(ammContext, quoteInfo); // Process the price of the hedge target account fee currency pair

      this.price_native_token(ammContext, quoteInfo); // native_token_usdt_price native_token_price  native_token_orig_price native_token_symbol
      // --
      await this.amount_check(ammContext); // format check
      this.renderInfo(ammContext, quoteInfo); // assetName assetTokenName assetChainInfo
      await this.min_amount(ammContext, quoteInfo); // min gas + min hedge check
      await this.calculate_capacity(ammContext, quoteInfo); // Calculate the maximum amount
      await this.native_token_min(ammContext, quoteInfo); // native_token_min
      await this.native_token_max(ammContext, quoteInfo); // native_token_max

      await this.analysis(ammContext, quoteInfo);
    } catch (e) {
      logger.error(e);
      this.reportQuotationError(ammContext, e)
      return [undefined, undefined, e.toString()];
    }
    return [quoteHash, quoteInfo];
  }
  private async reportQuotationError(ammContext: AmmContext, e: any) {

    const headers = { 'Content-Type': 'application/json' };
    let errorInfo = {
      errorMsg: '',
      errorStack: '',
      ammContext: ammContext
    };
    if (e instanceof Error) {
      // e 是 Error 对象，可以安全地访问 message 和 stack
      errorInfo.errorMsg = e.message;
      errorInfo.errorStack = e.stack || 'No stack trace available'; // 有些环境可能不提供栈追踪
    } else {
      errorInfo.errorMsg = e.toString(); // 直接转换为字符串
    }
    const body = stringify(errorInfo);
    logger.info("🪰", body)
    const url = "http://n8n.edge-dev.xyz/webhook/bd3ae405-e3df-4f99-b8ec-890391d5dfe9";
    try {
      const response = await axios.post(url, body, { headers });
      console.log('Server response:', response.data);
    } catch (error) {
      console.error('Error sending JSON data:', error);
    }
  }

  public async amount_check(ammContext: AmmContext) {
    const inputNumberBN = new BigNumber(ammContext.swapInfo.inputAmountNumber)
      .toFixed()
      .toString();
    if (!_.isFinite(Number(inputNumberBN.toString()))) {
      throw new Error(`amount  illegal:${ammContext.swapInfo.inputAmount}`);
    }
    return true;
  }

  public async quotationKeep(item: IBridgeTokenConfigItem) {
    if (!(await this.quotationPremise())) {
      logger.error(`quotation cond are not met`);
      return;
    }
    const quoteInfo = {
      cmd: ILpCmd.CMD_UPDATE_QUOTE,
      quote_data: {
        dst_usd_price: "",
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
    statusReport.appendStatus("lastQuotationKeep", new Date().getTime())
    // logger.debug(`send update quote to keep alive.${item.msmq_name}`);
    const quoteCmd = JSON.stringify(quoteInfo);
    redisPub.publish(item.msmq_name + "_" + item.relay_api_key, quoteCmd).catch((e: any) => {
      logger.debug(`quotation error:`, e);
    });
  }

  public async quotationPremise() {
    if (orderbook.spotOrderbookOnceLoaded) {
      return true;
    }
    logger.debug("waiting spotOrderbookOnceLoaded");
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
   * @param {AmmContext} ammContext  "context"
   * @param {*} sourceObject 的
   * @returns {void} ""
   */
  private async native_token_min(ammContext: AmmContext, sourceObject: any) {
    const gasSymbol = dataConfig.getChainTokenName(
      ammContext.baseInfo.dstToken.chainId
    );
    const gasTokenPrice = quotationPrice.getGasTokenBuyPrice(ammContext);
    let minHedgeCount = -1;
    if (ammContext.hedgeEnabled) {
      const accountIns = ammContext.bridgeItem.hedge_info.getAccountIns();
      if (accountIns) {
        [minHedgeCount] = await accountIns.order.getSpotTradeMinMax(
          `${gasSymbol}/USDT`,
          gasTokenPrice
        );
        minHedgeCount = SystemMath.execNumber(`${minHedgeCount} * 200%`); // Floating 10% up
      }
    }
    logger.info("native_token_min");
    logger.info({
      minHedgeCount,
    });
    const minCount = SystemMath.max([minHedgeCount]);

    Object.assign(sourceObject.quote_data, {
      native_token_min: new BigNumber(minCount).toString(),
      native_token_min_number: Number(new BigNumber(minCount).toString()),
    });
  }

  private async native_token_max(ammContext: AmmContext, sourceObject: any) {
    const dstChainId = ammContext.baseInfo.dstToken.chainId;

    let orderbookLiquidity = -1;
    if (ammContext.hedgeEnabled) {
      orderbookLiquidity =
        quotationPrice.getNativeTokenBuyLiquidity(dstChainId);
      logger.debug("gasToken orderbookLiquidity:", orderbookLiquidity);
    }

    const nativeTokenPrice =
      this.quotationPrice.getNativeTokenBuyPrice(dstChainId);
    const inputValueSwapGasCount = SystemMath.execNumber(
      `${ammContext.swapInfo.inputAmount}*${sourceObject.quote_data.src_usd_price}/${nativeTokenPrice}`,
      "input usd value = gas token(number)"
    );
    const maxSwapGasCount = SystemMath.execNumber(
      `${sourceObject.quote_data.capacity_num}*${sourceObject.quote_data.src_usd_price}/${nativeTokenPrice}`,
      "input usd value = gas token(number) "
    );
    logger.debug(
      "max supply value:",
      SystemMath.execNumber(
        `${sourceObject.quote_data.capacity_num}*${sourceObject.quote_data.src_usd_price}`
      ),
      "= gas number:",
      maxSwapGasCount
    );
    const tokenSymbol = dataConfig.getChainTokenName(
      ammContext.baseInfo.dstToken.chainId
    );
    const tokenStdSymbol = `${tokenSymbol}/USDT`;
    let minCexTradeCount = -1;
    let maxCexTradeCount = -1;
    if (ammContext.hedgeEnabled) {
      const accountIns = ammContext.bridgeItem.hedge_info.getAccountIns();
      if (accountIns) {
        [minCexTradeCount, maxCexTradeCount] =
          await accountIns.order.getSpotTradeMinMax(
            tokenStdSymbol,
            nativeTokenPrice
          );
        minCexTradeCount = SystemMath.execNumber(`${minCexTradeCount} * 110%`); // float up 10%
        maxCexTradeCount = SystemMath.execNumber(`${maxCexTradeCount} * 90%`); // float down 10%
      }
    }
    const dstChainMaxSwapUsd = dataConfig.getChainGasTokenUsdMax(dstChainId);
    const maxCountBN = SystemMath.exec(
      `${dstChainMaxSwapUsd} / ${nativeTokenPrice}`
    );

    logger.info("🐸", dstChainMaxSwapUsd, nativeTokenPrice);
    if (!maxCountBN.isFinite()) {
      throw `An error occurred in calculating the maximum quotation of the target chain token !isFinite`;
    }
    const maxCount = Number(maxCountBN.toFixed(8).toString());
    const nativeTokenBalance = await chainBalance.getBalance(
      ammContext.baseInfo.dstChain.id,
      ammContext.walletInfo.walletName,
      "0x0"
    );
    const minSourceData = [
      SystemMath.execNumber(`${nativeTokenBalance}*95%`), // Payment wallet balance
      maxCexTradeCount, // maximum value in order size
      maxCount, // The maximum number of gasTokens that can be swapped in the configuration
      inputValueSwapGasCount, // input value convertible quantity
      maxSwapGasCount, // supply value convertible quantity
      orderbookLiquidity, // order book liquidity
    ];
    logger.debug("minSourceData", minSourceData);
    let nativeTokenMax = SystemMath.min(minSourceData);
    if (!_.isFinite(nativeTokenMax)) {
      logger.error(`Error in calculating the maximum amount of tokens`);
      nativeTokenMax = 0;
    }
    const minNumber = _.get(
      sourceObject.quote_data,
      "native_token_min_number",
      0
    );
    if (Number(nativeTokenMax) < minNumber) {
      logger.error(`The maximum value cannot be less than the minimum value`);
      throw new Error(
        `The maximum value cannot be less than the minimum value max:${nativeTokenMax},min:${minNumber}`
      );
    }
    Object.assign(sourceObject.quote_data, {
      native_token_max: new BigNumber(nativeTokenMax).toFixed(8).toString(),
      native_token_max_number: Number(nativeTokenMax),
    });
    ammContext.quoteInfo = sourceObject.quote_data;
  }

  public async queryRealtimeQuote(ammContext: AmmContext): Promise<string> {
    await orderbook.refreshOrderbook(); // Immediately refresh the latest orderbook
    const quoteData = { quote_data: {} };
    this.price_dst_token(ammContext, quoteData);
    const [price] = await this.calculatePrice(ammContext, quoteData);
    return price;
  }

  @measure
  @memo()
  public async asksQuote(ammContext: AmmContext) {
    const enable = _.get(
      dataConfig.getBaseConfig(),
      "bridgeBaseConfig.enable",
      "true"
    );
    if (enable === "false") {
      console.log("amm status:", enable);
      logger.warn("amm is closed.");
      this.onAskQuoteFailed(ammContext,"amm is closed.");
      return;
    }
    if (
      mathlib
        .bignumber(ammContext.swapInfo.inputAmount)
        .eq(mathlib.bignumber(0))
    ) {
      logger.warn("The inputAmount must be greater than 0");
      this.onAskQuoteFailed(ammContext,"The inputAmount must be greater than 0");
      return;
    }

    const [quoteHash, quoteInfo, errMessage] = await this.quotationItem(ammContext);
    if (!_.isString(quoteHash)) {
      this.onAskQuoteFailed(ammContext,errMessage);
      return;
    }
    _.set(quoteInfo, "cid", ammContext.AskInfo.cid);
    _.set(quoteInfo, "cmd", ILpCmd.EVENT_ASK_REPLY);
    const quoteCmd = JSON.stringify(quoteInfo);
    // console.dir(quoteInfo.quote_data, { depth: null });
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
    ammContext.flowStatus = EFlowStatus.AnswerOffer;
    await ammContextModule.create(ammContext);
    await this.storeQuoteHistory(quoteHash, quoteInfo.quote_data);
  }
  public async onAskQuoteFailed(ammContext: AmmContext,message:string){
    const quoteInfo = await this.getFailedQuoteInfo(ammContext)
    _.set(quoteInfo, "cid", ammContext.AskInfo.cid);
    _.set(quoteInfo, "cmd", ILpCmd.EVENT_ASK_REPLY);
    _.set(quoteInfo, "quote_data.error_code", 1000);
    _.set(quoteInfo, "quote_data.error_message", message.toString());
    logger.info(`send Message`, ammContext.systemInfo.msmqName, quoteInfo.cmd);
    const quoteCmd = JSON.stringify(quoteInfo);
    redisPub
      .publish(ammContext.systemInfo.msmqName, quoteCmd)
      .catch((e: any) => {
        logger.debug(`publishing an offer message produced an error`, e);
      });
  }

  /**
   * Description calculate quote
   * @date 1/31/2023 - 5:30:29 PM
   *
   * @private
   * @param {AmmContext} ammContext "Context"
   * @param {any} sourceObject ""
   * @returns {*} ""
   */
  public async price(ammContext: AmmContext, sourceObject: any): Promise<any> {
    const [priceBn, origPrice, origTotalPriceBn] = await this.calculatePrice(
      ammContext,
      sourceObject
    );
    ammContext.quoteInfo.price = priceBn.toString();
    Object.assign(sourceObject.quote_data, {
      origPrice,
      price: priceBn.toString(),
      origTotalPrice: origTotalPriceBn.toString(),
    });
    sourceObject.quote_data.mode = ammContext.quoteInfo.mode;
    ammContext.quoteInfo = sourceObject.quote_data;
  }

  /**
   * Quotation for the assets that may be charged by the hedge account
   * @param ammContext
   * @param sourceObject
   */
  public price_hedge_fee_price(ammContext: AmmContext, sourceObject: any) {
    if (ammContext.hedgeEnabled) {
      const hedgeFeeSymbol = ammContext.bridgeItem.hedge_info
        .getHedgeIns()
        .getHedgeFeeSymbol();
      const { stdSymbol, asks } =
        this.quotationPrice.getCoinOrderBookByCoinName(hedgeFeeSymbol);
      if (stdSymbol && _.isArray(asks)) {
        const [[price]] = asks;
        Object.assign(sourceObject.quote_data, {
          hedge_fee_asset_price: price,
          hedge_fee_asset: hedgeFeeSymbol,
        });
      }
    }
  }

  private price_native_token(ammContext: AmmContext, sourceObject: any) {
    const { asks: nativeTokenAsks } =
      this.quotationPrice.getCoinOrderBookByCoinName(
        ammContext.baseInfo.dstChain.tokenName
      );
    const [[usdPrice]] = nativeTokenAsks;

    if (usdPrice === 0) {
      logger.warn(`can't get dstToken/StableCoin Price`);
      throw new Error(`can't get dstToken/StableCoin Price`);
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
      logger.warn(`can't get srcToken/StableCoin Price`);
      throw new Error(`can't get srcToken/StableCoin Price`);
    }
    const targetPriceWithFee = SystemMath.exec(
      `${srcTokenOrigPrice}/${nativeTokenPrice}*(1-${ammContext.baseInfo.fee})`
    );
    const targetPrice = SystemMath.exec(
      `${srcTokenOrigPrice}/${nativeTokenPrice}`
    );

    Object.assign(sourceObject.quote_data, {
      native_token_price: targetPriceWithFee.toString(), // srcToken/DstChain native currency with fee
      native_token_orig_price: targetPrice.toString(), // srcToken/DstChain native currency
      native_token_symbol: `${gasSymbol}/USDT`,
      native_token_usdt_price: new BigNumber(usdPrice).toString(), // DstChain native currency/USDT
    });
  }

  private price_src_token(ammContext: AmmContext, sourceObject: any) {
    const { bids: srcTokenBids } =
      this.quotationPrice.getCoinOrderBookByCoinName(
        ammContext.baseInfo.srcToken.symbol
      );
    const [[price]] = srcTokenBids;

    if (price === 0) {
      logger.warn(`can't get srcToken/StableCoin`);
      throw new Error(`can't get srcToken/StableCoin`);
    }

    Object.assign(sourceObject.quote_data, {
      src_usd_price: new BigNumber(price).toString(),
    });
    ammContext.quoteInfo = sourceObject.quote_data;
  }

  /**
   * dstToken/StableCoin
   * @date 2023/5/19 - 11:51:48
   *
   * @private
   * @param {AmmContext} ammContext
   * @param {*} sourceObject
   */
  private price_dst_token(ammContext: AmmContext, sourceObject: any) {
    const { asks: dstTokenAsks } = this.quotationPrice.getCoinOrderBook(
      ammContext.baseInfo.dstToken.address,
      ammContext.baseInfo.dstToken.chainId
    );

    const [[dstUsdPrice]] = dstTokenAsks;
    if (dstUsdPrice === 0) {
      logger.warn(
        `No dstToken/USDT price obtained: token=${ammContext.baseInfo.dstToken.symbol}, ` +
        `address=${ammContext.baseInfo.dstToken.address}, ` +
        `chainId=${ammContext.baseInfo.dstToken.chainId}, ` +
        `price=${dstUsdPrice}, ` +
        `asks=${JSON.stringify(dstTokenAsks)}`
      );
      throw new Error(
        `No dstToken/USDT price obtained for ${ammContext.baseInfo.dstToken.symbol}, ` +
        `price=${dstUsdPrice}`
      );
    }
    Object.assign(sourceObject.quote_data, {
      dst_usd_price: dstUsdPrice,
    });
  }

  private getSwapType(ammContext: AmmContext) {
    const srcSymbol = ammContext.baseInfo.srcToken.symbol;
    const srcCoinType = ammContext.baseInfo.srcToken.coinType;
    const dstSymbol = ammContext.baseInfo.dstToken.symbol;
    const dstCoinType = ammContext.baseInfo.dstToken.coinType;

    if (!srcSymbol || !dstSymbol) {
      logger.error(`The basic information was not found`);
      throw new Error("`The basic information was not found");
    }
    if (
      srcCoinType === ICoinType.StableCoin &&
      dstCoinType === ICoinType.StableCoin
    ) {
      // USDT-USDT not 11
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
    throw "unsupported type";
  }

  private async calculatePrice_bb(
    ammContext: AmmContext,
    sourceObject: any = undefined
  ): Promise<[string, string, string]> {
    // ETH/AVAX
    const srcTokenPrice = this.quotationPrice.getCoinOrderBook(
      ammContext.baseInfo.srcToken.address,
      ammContext.baseInfo.srcToken.chainId
    );
    const dstTokenPrice = this.quotationPrice.getCoinOrderBook(
      ammContext.baseInfo.dstToken.address,
      ammContext.baseInfo.dstToken.chainId
    );
    const priceBn = this.quotationPrice.getCoinCoinPrice(
      new BigNumber(1),
      srcTokenPrice,
      dstTokenPrice
    );
    await this.resizeFee(
      ammContext,
      _.get(sourceObject.quote_data, "dst_usd_price"),
      ammContext.swapInfo.inputAmount,
      priceBn
    );
    const targetPriceBN = SystemMath.exec(
      `${priceBn} * (1-${ammContext.baseInfo.fee})`,
      "Calculate the price"
    );
    Object.assign(sourceObject.quote_data, {
      orderbook: {
        A: srcTokenPrice,
        B: dstTokenPrice,
      },
    });
    const totalOrigPrice = SystemMath.exec(
      `${ammContext.swapInfo.inputAmountNumber}*${priceBn}`
    );

    return [
      targetPriceBN.toString(),
      priceBn.toString(),
      totalOrigPrice.toString(),
    ];
  }

  /**
   * Coin-StableCoin Price
   * @date 2023/4/13 - 16:29:37
   * @private
   * @param {AmmContext} ammContext "context"
   * @param {*} [sourceObject=undefined] ""
   * @returns {[string, string, string]} ""
   */
  private async calculatePrice_bs(
    ammContext: AmmContext,
    sourceObject: any = undefined
  ): Promise<[string, string, string]> {
    let quoteOrderbookType = "getCoinOrderBook";
    if (ammContext.hedgeEnabled) {
      quoteOrderbookType = "getCoinExecuteOrderbook";
    }
    // @ts-ignore
    const { stdSymbol, bids, asks, timestamp } = this.quotationPrice[
      quoteOrderbookType
    ](
      ammContext.baseInfo.srcToken.address,
      ammContext.baseInfo.srcToken.chainId,
      ammContext.swapInfo.inputAmountNumber
    );
    if (stdSymbol === null) {
      logger.error(
        SystemError.getErrorMessage(SystemErrorDict.orderbook.getError),
        "calculatePrice_bs"
      );
      SystemError.throwError(SystemErrorDict.orderbook.getError);
    }
    logger.info("get orderbook ", stdSymbol);
    const [[price]] = bids;
    await this.resizeFee(
      ammContext,
      _.get(sourceObject.quote_data, "dst_usd_price"),
      ammContext.swapInfo.inputAmount,
      price
    );
    Object.assign(sourceObject.quote_data, {
      orderbook: {
        A: { bids, asks, timestamp },
        B: null,
      },
    });

    return [
      SystemMath.exec(
        `${price} * (1 - ${ammContext.baseInfo.fee})`,
        "Calculate the price"
      ).toString(),
      SystemMath.exec(`1* ${price}`).toString(),
      SystemMath.exec(
        `${ammContext.swapInfo.inputAmountNumber} * ${price}`
      ).toString(),
    ];
  }

  private async calculatePrice_ss(
    ammContext: AmmContext,
    sourceObject: any = undefined
  ): Promise<[string, string, string]> {
    // USDT/BUSD
    const srcTokenPrice = this.quotationPrice.getCoinOrderBook(
      ammContext.baseInfo.srcToken.address,
      ammContext.baseInfo.srcToken.chainId
    );
    const dstTokenPrice = this.quotationPrice.getCoinOrderBook(
      ammContext.baseInfo.dstToken.address,
      ammContext.baseInfo.dstToken.chainId
    );

    const priceBn = this.quotationPrice.getCoinCoinPrice(
      new BigNumber(1),
      srcTokenPrice,
      dstTokenPrice
    );
    await this.resizeFee(
      ammContext,
      _.get(sourceObject.quote_data, "dst_usd_price"),
      ammContext.swapInfo.inputAmount,
      priceBn
    );
    const targetPriceBN = SystemMath.exec(
      `${priceBn} * (1-${ammContext.baseInfo.fee})`,
      "Calculate the price"
    );
    Object.assign(sourceObject.quote_data, {
      orderbook: {
        A: srcTokenPrice,
        B: dstTokenPrice,
      },
    });
    const totalOrigPrice = SystemMath.exec(
      `${ammContext.swapInfo.inputAmountNumber}*${priceBn}`
    );
    return [
      targetPriceBN.toString(),
      priceBn.toString(),
      totalOrigPrice.toString(),
    ];
  }

  private async calculatePrice_11(
    ammContext: AmmContext,
    sourceObject: any = undefined
  ): Promise<[string, string, string]> {
    const priceBn = mathlib.bignumber(1);
    await this.resizeFee(
      ammContext,
      _.get(sourceObject.quote_data, "dst_usd_price"),
      ammContext.swapInfo.inputAmount,
      priceBn
    );

    const targetPriceBN = SystemMath.exec(
      `${priceBn}* (1-${ammContext.baseInfo.fee})`,
      "Calculate the price"
    );
    Object.assign(sourceObject.quote_data, {
      orderbook: {},
    });
    const totalOrigPrice = mathlib
      .bignumber(ammContext.swapInfo.inputAmountNumber)
      .times(priceBn);
    return [
      targetPriceBN.toString(),
      priceBn.toString(),
      totalOrigPrice.toString(),
    ];
  }

  private async calculatePrice_sb(
    ammContext: AmmContext,
    sourceObject: any = undefined
  ): Promise<[string, string, string]> {
    // return { stdSymbol: null, bids: [[0, 0]], asks: [[0, 0]] };
    // ETH/USDT
    const { stdSymbol, bids, asks, timestamp } =
      this.quotationPrice.getCoinOrderBook(
        ammContext.baseInfo.dstToken.address,
        ammContext.baseInfo.dstToken.chainId
      );
    if (stdSymbol === null) {
      logger.error(
        `Failed to get the orderbook and could not calculate the price`,
        "calculatePrice_bs"
      );
      throw "Failed to get the orderbook and could not calculate the price";
    }

    const [[price]] = asks;
    const priceBn = mathlib.bignumber(1).div(mathlib.bignumber(price));
    await this.resizeFee(
      ammContext,
      _.get(sourceObject.quote_data, "dst_usd_price"),
      ammContext.swapInfo.inputAmount,
      priceBn
    );
    const targetPriceBN = SystemMath.exec(
      `${priceBn} * (1 - ${ammContext.baseInfo.fee})`,
      "Calculate the price"
    );
    Object.assign(sourceObject.quote_data, {
      orderbook: {
        A: null,
        B: { bids, asks, timestamp },
      },
    });
    const totalOrigPrice = SystemMath.execNumber(
      `${ammContext.swapInfo.inputAmountNumber}*${priceBn}`
    );
    return [
      targetPriceBN.toFixed(8).toString(),
      SystemMath.exec(`1/${price}`).toFixed(8).toString(),
      totalOrigPrice.toString(),
    ];
  }

  private async calculatePrice(
    ammContext: AmmContext,
    sourceObject: any = undefined
  ): Promise<[string, string, string]> {
    const swapType = this.getSwapType(ammContext);
    logger.info(`swapType :`, swapType);
    if (swapType === "bb") {
      // ETH-AVAX
      ammContext.quoteInfo.mode = "bb";
      Object.assign(sourceObject.quote_data, { mode: "bb" });
      return await this.calculatePrice_bb(ammContext, sourceObject);
    }
    if (swapType === "bs") {
      // ETH-USDT
      ammContext.quoteInfo.mode = "bs";
      Object.assign(sourceObject.quote_data, { mode: "bs" });
      return await this.calculatePrice_bs(ammContext, sourceObject);
    }
    if (swapType === "ss") {
      // USDT/USDT  or  USDT/USDC
      ammContext.quoteInfo.mode = "ss";
      Object.assign(sourceObject.quote_data, { mode: "ss" });
      return await this.calculatePrice_ss(ammContext, sourceObject);
    }
    if (swapType === "11") {
      // ETH/ETH or  BTC/BTC
      ammContext.quoteInfo.mode = "11";
      Object.assign(sourceObject.quote_data, { mode: "11" });
      return await this.calculatePrice_11(ammContext, sourceObject);
    }
    if (swapType === "sb") {
      ammContext.quoteInfo.mode = "sb";
      Object.assign(sourceObject.quote_data, { mode: "sb" });
      return await this.calculatePrice_sb(ammContext, sourceObject);
    }
    throw new Error("exchange not implemented");
  }

  private async min_amount(ammContext: AmmContext, sourceObject: any) {
    let minHedgeInputNumber = -1;
    const srcTokenPrice = quotationPrice.getSrcTokenBuyPrice(ammContext);
    if (ammContext.hedgeEnabled) {
      const dstTokenPrice = quotationPrice.getDstTokenSellPrice(ammContext);
      const gasTokenPrice = quotationPrice.getGasTokenBuyPrice(ammContext);
      minHedgeInputNumber = await ammContext.bridgeItem.hedge_info
        .getHedgeIns()
        .getMinHedgeAmount(
          ammContext,
          srcTokenPrice,
          dstTokenPrice,
          gasTokenPrice
        );
    }
    const configConvertInput = -1
    // SystemMath.execNumber(
    //   `10/${srcTokenPrice}*100.3%`
    // );
    const minAmount = SystemMath.max([configConvertInput, minHedgeInputNumber]);
    if (minAmount === undefined) {
      throw new Error("Minimum volume calculation error");
    }
    Object.assign(sourceObject.quote_data, {
      min_amount: new BigNumber(minAmount).toString(),
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
    Object.assign(sourceObject.quote_data, {
      assetName: `${token0}/${token1}`,
      assetTokenName: `${ammContext.baseInfo.srcToken.address}/${ammContext.baseInfo.dstToken.address}`,
      assetChainInfo: `${ammContext.baseInfo.srcToken.chainId}-${ammContext.baseInfo.dstToken.chainId}`,
    });
  }

  /**
   * maximum supply
   * @date 2023/2/27 - 13:43:34
   *
   * @private
   * @async
   * @param {AmmContext} ammContext "ammContext"
   * @param {*} sourceObject "quotation object"
   * @returns {*} ""
   */
  private async calculate_capacity(ammContext: AmmContext, sourceObject: any) {
    let hedgeCapacity = -1;
    let orderbookLiquidity = -1;
    if (ammContext.hedgeEnabled) {
      if (
        ammContext.quoteInfo.mode == "ss" ||
        ammContext.quoteInfo.mode == "11"
      ) {
        // Unconstrained by liquidity limits
        orderbookLiquidity = -1;
      } else {
        orderbookLiquidity = await this.calculateLiquidity(ammContext);
      }
    }

    const dstBalanceMaxSwap = await this.dstBalanceMaxSwap(ammContext);
    if (ammContext.hedgeEnabled) {
      if (
        ammContext.quoteInfo.mode == "ss" ||
        ammContext.quoteInfo.mode == "11"
      ) {
        hedgeCapacity = -1;
      } else {
        hedgeCapacity = await ammContext.bridgeItem.hedge_info
          .getHedgeIns()
          .calculateCapacity(ammContext);
      }
    }

    const capacity = SystemMath.min([
      hedgeCapacity,
      dstBalanceMaxSwap,
      orderbookLiquidity,
    ]);
    logger.info({
      type: "capacity = SystemMath.min",
      hedgeCapacity,
      dstBalanceMaxSwap,
      orderbookLiquidity,
      result: capacity,
    });

    logger.debug(
      `maximum supply`,
      new BigNumber(capacity)
        .toFixed(ammContext.baseInfo.srcToken.precision)
        .toString()
    );
    logger.info(
      "convert info ",
      capacity.toString(),
      ammContext.baseInfo.srcToken.precision
    );
    const etherWei = EthUnit.toWei(
      new BigNumber(capacity)
        .toFixed(ammContext.baseInfo.srcToken.precision)
        .toString(),
      ammContext.baseInfo.srcToken.precision
    );
    _.assign(sourceObject.quote_data, {
      capacity_num: new BigNumber(capacity)
        .toFixed(ammContext.baseInfo.srcToken.precision)
        .toString(),
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
      throw new Error(`unknown exchange mode`);
    }
    const { bids } =
      quotationPrice.getCoinOrderBookLiquidityByCoinName(leftSymbol);
    let bidPrice = bids;
    if (ammContext.quoteInfo.mode === "sb") {
      bidPrice = SystemMath.execNumber(
        `${bids}* ${ammContext.quoteInfo.dst_usd_price}`
      );
      logger.info(
        `Orderbook ${bids} ${ammContext.baseInfo.dstToken.symbol} can provide【${ammContext.baseInfo.srcToken.symbol} liquidity ${bidPrice}`
      );
    }
    if (ammContext.quoteInfo.mode === "ss") {
      bidPrice = SystemMath.execNumber(
        `${bids}* ${ammContext.quoteInfo.native_token_usdt_price}/${ammContext.quoteInfo.src_usd_price}`
      );
      logger.info(
        `Orderbook ${bids} ${ammContext.baseInfo.dstChain.tokenName} can provide【${ammContext.baseInfo.srcToken.symbol}】liquidity ${bidPrice}`
      );
    }
    if (ammContext.quoteInfo.mode === "11") {
      // When users exchange native currency, they need to sell part of the left side or sell all
      // It should be the minimum value of the liquidity of selling on the left and the liquidity of buying on the right, temporarily using the liquidity of selling on the left  orderbook bids
    }
    if (ammContext.quoteInfo.mode === "bs") {
      // left liquidity
    }
    if (ammContext.quoteInfo.mode === "bb") {
      // It should be the minimum value of the liquidity of selling on the left and the liquidity of buying on the right, temporarily using the liquidity of selling on the left  orderbook bids
    }

    return bidPrice;
  }

  /**
   * The maximum value of target chain balance swap
   * @param ammContext
   * @private
   */
  private async dstBalanceMaxSwap(ammContext: AmmContext): Promise<number> {
    const dstTokenBalance = await chainBalance.getBalance(
      ammContext.baseInfo.dstToken.chainId,
      ammContext.walletInfo.walletName,
      ammContext.baseInfo.dstToken.address
    );
    logger.info(
      `DstChain: [${ammContext.baseInfo.dstToken.chainId}] [${ammContext.baseInfo.dstToken.symbol}],Balance[${dstTokenBalance}] able to provide`
    );
    const {
      asks: [[dstTokenPrice]],
    } = quotationPrice.getCoinOrderBook(
      ammContext.baseInfo.dstToken.address,
      ammContext.baseInfo.dstToken.chainId
    );
    const {
      asks: [[srcTokenPrice]],
    } = quotationPrice.getCoinOrderBook(
      ammContext.baseInfo.srcToken.address,
      ammContext.baseInfo.srcToken.chainId
    );
    const dstTokenUsdtPriceBN = new BigNumber(dstTokenPrice).times(
      new BigNumber(dstTokenBalance)
    );
    const dstTokenDexBalanceToSrcTokenCount = dstTokenUsdtPriceBN
      .div(srcTokenPrice)
      .toFixed(8)
      .toString();
    logger.info(
      `DstChain: [${ammContext.baseInfo.dstToken.chainId}] [${ammContext.baseInfo.dstToken.symbol}],Balance[${dstTokenBalance}] able to provide,SrcToken[${ammContext.baseInfo.srcToken.symbol}] Max Input:${dstTokenDexBalanceToSrcTokenCount}`
    );
    const dstTokenDexBalanceToSrcTokenCountNumber = Number(
      dstTokenDexBalanceToSrcTokenCount
    );
    return dstTokenDexBalanceToSrcTokenCountNumber;
  }

  /**
   * analyze price
   * @param ammContext
   * @param sourceObject
   */
  private async analysis(ammContext: AmmContext, sourceObject: any) {
    const max = _.get(sourceObject, "quote_data.capacity_num", 0);
    const min = _.get(sourceObject, "quote_data.min_amount", 0);
    const input = ammContext.swapInfo.inputAmountNumber;
    if (input < min) {
      console.dir(sourceObject.quote_data, ConsoleDirDepth5);
      logger.warn(`The amount of input is too small min:${min},input:${input}`);
      throw new Error(`The amount of input is too small`);
    }
    if (max <= input) {
      console.dir(sourceObject.quote_data, ConsoleDirDepth5);
      logger.warn(
        "The quotation has expired, and the maximum quantity is not enough to meet the input requirement.",
        `max:${max},input:${input}`
      );
      throw new Error(
        `The quotation has expired, and the maximum quantity is not enough to meet the input requirement`
      );
    }
  }
  private async resizeFee(
    ammContext: AmmContext,
    targetCoinUsdPrice: mathlib.BigNumber,
    leftInputAmount: string,
    price: mathlib.BigNumber
  ): Promise<void> {
    const minChargeUsdt = _.get(
      dataConfig.getBaseConfig(),
      "bridgeBaseConfig.minChargeUsdt",
      "0"
    );
    const minChargeUsdtBn: mathlib.BigNumber = mathlib.bignumber(minChargeUsdt);
    logger.info(`min charge usdt ${minChargeUsdtBn.toFixed(3)}`);
    if (minChargeUsdtBn.eq(mathlib.bignumber(0))) {
      logger.warn("There is no minimum charge configured.");
      return;
    }

    const total_usd_value = SystemMath.exec(
      `${leftInputAmount}*${price}* ${targetCoinUsdPrice}`
    );

    const gasResult = await this.calculateRecentGasAverage(ammContext.baseInfo.dstChain.id);
    logger.info(`🌍 gas used is:${gasResult}`)
    const want_usdt_percentage = SystemMath.exec(
      `${mathlib.bignumber(gasResult.averageGasUsd)}/${total_usd_value}`
    );

    logger.info({
      title: "⚖️⚖️⚖️⚖️⚖️⚖️⚖️⚖️⚖️",
      total_usd_value: total_usd_value,
      want_usdt_percentage: want_usdt_percentage,
      average_gas_usd: gasResult.averageGasUsd
    });
    if (want_usdt_percentage.gt(mathlib.bignumber(1))) {
      logger.error("❌ Gas cost exceeds transaction value. Cannot proceed with the transaction.");
      throw new Error("Transaction gas cost exceeds the total transaction value. Please increase transaction amount or try again later.");
    }
    if (want_usdt_percentage.gt(ammContext.baseInfo.fee)) {
      logger.info("🚩resize fee:", want_usdt_percentage.toFixed(3));
      ammContext.baseInfo.sourceFee = ammContext.baseInfo.fee;
      ammContext.baseInfo.fee = parseFloat(want_usdt_percentage.toFixed(3));
      logger.info({
        fee: `${want_usdt_percentage.toFixed(3)}--${ammContext.baseInfo.fee}`,
        resized_fee: ammContext.baseInfo.fee,
      });
    }
  }
  private async calculateRecentGasAverage(chainId: number) {
    try {
      const transactions = await ammContextModule.find({
        "dexTradeInfo_in": { $exists: true },
        "dexTradeInfo_in_confirm": { $exists: true },
        "baseInfo.dstChain.id": chainId
      })
        .sort({ "createtime": -1 })
        .limit(10)
        .lean();

      if (transactions.length === 0) {
        return { averageGasUsd: 0 };
      }

      let totalGasUsd = 0;
      let validTxCount = 0;

      for (const tx of transactions) {
        try {
          const nativeTokenPrice = parseFloat(tx.quoteInfo.native_token_usdt_price);
          const nativeTokenPrecision = tx.baseInfo.dstChain.nativeTokenPrecision;

          let totalGasForTx = 0;

          if (tx.dexTradeInfo_in?.rawData) {
            const gasUsedIn = JSON.parse(tx.dexTradeInfo_in.rawData.transfer_info).gasUsed;
            totalGasForTx += parseInt(gasUsedIn);
          }

          if (tx.dexTradeInfo_in_confirm?.rawData) {
            const gasUsedConfirm = JSON.parse(tx.dexTradeInfo_in_confirm.rawData.transfer_info).gasUsed;
            totalGasForTx += parseInt(gasUsedConfirm);
          }

          const transferInfo = JSON.parse(tx.dexTradeInfo_in.rawData.transfer_info);
          const gasPrice = transferInfo.effectiveGasPrice ?
            parseInt(transferInfo.effectiveGasPrice, 16) : 1;
          const gasUsd = (totalGasForTx * gasPrice * Math.pow(10, -nativeTokenPrecision) * nativeTokenPrice);

          totalGasUsd += gasUsd;
          validTxCount++;
        } catch (err) {
          logger.error(`Error processing transaction ${tx._id}:`, err);
          continue;
        }
      }

      return {
        averageGasUsd: validTxCount > 0 ? totalGasUsd / validTxCount : 0
      };
    } catch (err) {
      logger.error("Error calculating gas average:", err);
      return { averageGasUsd: 0 };
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
