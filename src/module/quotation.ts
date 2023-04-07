/**
 *报价的第一版服务，还在填充逻辑中
 * **/
import { IBridgeTokenConfigItem, ICoinType, IHedgeType, ILpCmd, } from "../interface/interface";
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
import { QuotationPrice } from "./quotation/quotation_price";
import { AmmContext } from "../interface/context";
import { ammContextModule } from "../mongo_module/amm_context";
import { systemRedisBus } from "../system_redis_bus";
import { getNumberFrom16 } from "../utils/ethjs_unit";

const { v4: uuidv4 } = require("uuid");

const Web3 = require("web3");

const web3 = new Web3();
// @ts-ignore
const cTable = require("console.table");
const var_dump = require("var_dump");

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
    logger.debug("Quotation program loading list completed", this.bridgeTokenList.length);
    this.startQuotation()
      .then(() => {
        logger.info(`Start a timed quote`);
      });
  }

  private async startQuotation() {
    if (orderbook.spotOrderbookOnceLoaded === false) {
      logger.warn("spot orderbook 还没有初始化完毕,暂时不报价");
      return;
    }
    for (const item of this.bridgeTokenList) {
      this.quotationKeep(item)
        .then(() => {
          //
        }); // 对单一个跨链进行报价
    }
    logger.info("完成了一次定时报价Keep", new Date().getTime());
    setTimeout(() => {
      this.startQuotation();
    }, 1000 * 30);
  }

  /**
   * 针对一行记录开始报价
   * @param ammContext
   */
  public async quotationItem(ammContext: AmmContext): Promise<any> {
    const quoteHash = crypto.createHash("sha1")
      .update(uuidv4())
      .digest("hex");
    const quoteInfo = {
      cmd: ILpCmd.CMD_UPDATE_QUOTE,
      quote_data: {
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
        quote_hash: quoteHash,
      },
    };
    try {
      this.prePrice(ammContext); // 前置检查,检查是否支持币对兑换，主要看是 币 和稳定币之间的关系
      ammContext.quoteInfo.mode = this.getSwapType(ammContext);
      if (dataConfig.getHedgeConfig().hedgeType !== IHedgeType.Null) {
        await hedgeManager.getHedgeIns(dataConfig.getHedgeConfig().hedgeType).checkSwapAmount(ammContext);
      }
      await this.price(ammContext, quoteInfo);
      await this.priceNativeToken(ammContext, quoteInfo);
      await this.priceSrcToken(ammContext, quoteInfo);
      await this.amountCheck(ammContext);
      await this.min_amount(ammContext, quoteInfo);
      await this.renderInfo(ammContext, quoteInfo);
      await this.priceDstGasToken(ammContext, quoteInfo); // 计算目标链的Gas币兑换量
      this.calculateGas(ammContext, quoteInfo); // 计算gas
      await this.calculateCapacity(ammContext, quoteInfo); // 计算最大量
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
   * @param ammContext
   */
  public async amountCheck(ammContext: AmmContext) {
    const inputNumberBN = new BigNumber(getNumberFrom16(ammContext.swapInfo.inputAmount, ammContext.baseInfo.srcToken.precision)).toFixed().toString();
    if (!_.isFinite(Number(inputNumberBN.toString()))) {
      throw new Error(`输入的量不合法:${ammContext.swapInfo.inputAmount}`);
    }
    return true;
  }

  public async quotationKeep(item: IBridgeTokenConfigItem) {
    if (!await this.quotationPremise()) {
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
      },
    };
    // logger.debug(`send update quote to keep alive.${item.msmq_name}`);
    const quoteCmd = JSON.stringify(quoteInfo);
    redisPub.publish(item.msmq_name, quoteCmd)
      .catch((e: any) => {
        logger.debug(`报价产生了错误`, e);
      });
  }

  public async quotationPremise() {
    if (orderbook.spotOrderbookOnceLoaded === true) {
      return true;
    }
    return false;
  }

  /**
   * @param {AmmContext} ammContext  币对配置
   * @param {*} sourceObject 的
   * @returns {void} ""
   */
  private async priceDstGasToken(ammContext: AmmContext, sourceObject: any) {
    const [token0] = dataConfig.getCexStdSymbolInfoByToken(
      ammContext.baseInfo.srcToken.address,
      ammContext.baseInfo.dstToken.address,
      ammContext.baseInfo.srcToken.chainId,
      ammContext.baseInfo.dstToken.chainId,
    );
    let quoteType = "bid";
    const gasSymbol = dataConfig.getChainTokenName(
      ammContext.baseInfo.dstToken.chainId,
    );
    if (!gasSymbol) {
      throw new Error(
        `没有找到目标链的Token Symbol${ammContext.baseInfo.dstToken.chainId}`,
      );
    }
    const srcTokenSymbol = `${ammContext.baseInfo.srcToken.address}/0x0`;
    const { bids: bid, asks: ask } = this.quotationPrice.getCoinUsdtOrderbook(
      ammContext.baseInfo.srcToken.address,
      ammContext.baseInfo.srcToken.chainId,
    );
    let srcUPriceInfo = bid;
    if (token0.coinType === ICoinType.StableCoin) {
      quoteType = "ask";
      srcUPriceInfo = ask;
    }
    const [[srcUprice]] = srcUPriceInfo;
    if (!_.isFinite(srcUprice) || srcUprice === 0) {
      logger.error(`没有找到U价报价失败`);
      throw new Error(`没有找到U价，报价失败${srcTokenSymbol}`);
    }

    const {
      asks: [[tokenUPrice]],
    } = this.quotationPrice.getCoinUsdtOrderbookByCoinName(gasSymbol);
    if (!_.isFinite(tokenUPrice) || tokenUPrice === 0) {
      logger.error(`没有找到U价，报价失败 ${gasSymbol}`);
      throw new Error(
        `目标链Gas币Usdt 价值获取失败，无法报价${srcTokenSymbol}`,
      );
    }
    const targetPrice = new BigNumber(srcUprice)
      .div(new BigNumber(tokenUPrice))
      .toFixed(8)
      .toString();
    const minGasUsed = dataConfig.getChainGasTokenUsd(
      ammContext.baseInfo.dstToken.chainId,
    ); // usd 单位 ,兑换多少U的 nToken
    // 至少需要换多少个目标Token
    const minGasTokenCount = new BigNumber(minGasUsed)
      .div(new BigNumber(tokenUPrice))
      .toFixed(8)
      .toString();
    logger.debug(minGasTokenCount);

    Object.assign(sourceObject.quote_data, {
      quote_orderbook_type: quoteType,
      native_token_price: targetPrice, // ETH-USDT 到BSC  则是 ETH/BNB的价格
      native_token_symbol: `${gasSymbol}/USDT`,
      native_token_max: new BigNumber(minGasTokenCount)
        .times(new BigNumber(10))
        .toFixed(8)
        .toString(),
      native_token_min_usd: minGasUsed.toString(),
      native_token_min_count: minGasTokenCount,
      native_token_min: minGasTokenCount,
    });
  }

  public async queryRealtimeQuote(ammContext: AmmContext): Promise<string> {
    await orderbook.refreshOrderbook(); // 立即刷新一次最新的orderbook ，然后计算价格
    const [price] = this.calculatePrice(ammContext, { quote_data: {} });
    return price;
  }

  public async asksQuote(ammContext: AmmContext) {
    const [quoteHash, quoteInfo] = await this.quotationItem(ammContext); // 使用问价模式报价
    if (!_.isString(quoteHash)) {
      return;
    }
    _.set(quoteInfo, "cid", ammContext.AskInfo.cid);
    _.set(quoteInfo, "cmd", ILpCmd.EVENT_ASK_REPLY);
    const quoteCmd = JSON.stringify(quoteInfo);
    console.table(quoteInfo.quote_data);
    logger.info(`send Message`, ammContext.systemInfo.msmqName, quoteInfo.cmd);
    redisPub
      .publish(ammContext.systemInfo.msmqName, quoteCmd)
      .catch((e: any) => {
        logger.debug(`报价产生了错误`, e);
      });
    const mode = _.clone(ammContext.quoteInfo.mode);
    ammContext.quoteInfo = quoteInfo.quote_data;
    ammContext.quoteInfo.mode = mode;
    await ammContextModule.create(ammContext);
    await this.storeQuoteHistory(quoteHash, quoteInfo.quote_data);
  }

  /**
   * Description 检查是否可以报价
   * @date 2023/2/8 - 13:32:10
   *
   * @private
   * @param {AmmContext} ammContext "上下文"
   * @returns {boolean} ""
   */
  private prePrice(ammContext: AmmContext): boolean {
    const token0 = ammContext.baseInfo.srcToken;
    const token1 = ammContext.baseInfo.dstToken;
    if (token0.symbol !== token1.symbol) {
      if (
        token0.coinType === ICoinType.StableCoin &&
        token1.coinType === ICoinType.StableCoin
      ) {
        return true;
        // throw new Error(
        //   `暂时不支持不同稳定币之间的兑换${token0.symbol}/${token1.symbol}`
        // );
      }
      if (
        token0.coinType !== ICoinType.StableCoin &&
        token1.coinType !== ICoinType.StableCoin
      ) {
        // 如果左右两个币不一样，且没有任何一个是稳定币，则不支持
        // throw new Error(`暂不支持的报价币对${token0.symbol}/${token1.symbol}`);
      }
    }
    return true;
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
    // 扣除千三的手续费，单价中
    // 获取目标币的U价格
    const { bids: dstTokenBids } = this.quotationPrice.getCoinUsdtOrderbook(
      ammContext.baseInfo.dstToken.address,
      ammContext.baseInfo.dstToken.chainId,
    );

    const [[usdPrice]] = dstTokenBids;
    if (usdPrice === 0) {
      logger.warn(`没有获取到dstToken/USDT,无法进行报价`);
      throw new Error(`没有获取到dstToken/USDT,无法进行报价`);
    }
    const [bTargetPrice, origPrice] = this.calculatePrice(
      ammContext,
      sourceObject,
    );
    ammContext.quoteInfo.price = bTargetPrice.toString();
    Object.assign(sourceObject.quote_data, {
      origPrice,
      price: bTargetPrice.toString(),
      usd_price: usdPrice, // 目标币的U价格  如 ETH-USDT   则 1  ETH-AVAX  则显示  Avax/Usdt的价格
    });
  }

  private priceNativeToken(ammContext: AmmContext, sourceObject: any) {
    const { asks: nativeTokenAsks } = this.quotationPrice.getCoinUsdtOrderbookByCoinName(ammContext.baseInfo.dstChain.tokenName);
    const [[usdPrice]] = nativeTokenAsks;

    if (usdPrice === 0) {
      logger.warn(`没有获取到目标链，原生币的报价`);
      throw new Error(`没有获取到dstToken/USDT,无法进行报价`);
    }

    Object.assign(sourceObject.quote_data, {
      native_token_usdt_price: new BigNumber(usdPrice).toString(),
    });
  }

  private priceSrcToken(ammContext: AmmContext, sourceObject: any) {
    const { asks: srcTokenAsks } = this.quotationPrice.getCoinUsdtOrderbookByCoinName(ammContext.baseInfo.srcToken.symbol);
    const [[usdPrice]] = srcTokenAsks;

    if (usdPrice === 0) {
      logger.warn(`没有获得源链，币的Usdt报价`);
      throw new Error(`没有获得源链，币的Usdt报价`);
    }

    Object.assign(sourceObject.quote_data, {
      src_usd_price: new BigNumber(usdPrice).toString(),
    });
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
    if (srcSymbol === dstSymbol) {
      return "11";
    }
    if (srcCoinType === ICoinType.Coin && dstCoinType === ICoinType.Coin) {
      return "bb";
    }
    if (
      srcCoinType === ICoinType.StableCoin &&
      dstCoinType === ICoinType.StableCoin
    ) {
      return "ss";
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
    sourceObject: any = undefined,
  ): [string, string] {
    // ETH/AVAX
    const srcTokenPrice = this.quotationPrice.getCoinUsdtOrderbook(
      ammContext.baseInfo.srcToken.address,
      ammContext.baseInfo.srcToken.chainId,
    );
    const dstTokenPrice = this.quotationPrice.getCoinUsdtOrderbook(
      ammContext.baseInfo.dstToken.address,
      ammContext.baseInfo.dstToken.chainId,
    );
    const priceBn = this.quotationPrice.getABPrice(
      new BigNumber(1),
      srcTokenPrice,
      dstTokenPrice,
    );
    const targetPriceBN = priceBn.times(new BigNumber(0.997));
    Object.assign(sourceObject.quote_data, {
      orderbook: {
        A: srcTokenPrice,
        B: dstTokenPrice,
      },
    });
    var_dump(sourceObject.quote_data);
    return [targetPriceBN.toString(), priceBn.toString()];
  }

  private calculatePrice_bs(
    ammContext: AmmContext,
    sourceObject: any = undefined,
  ): [string, string] {
    // return { stdSymbol: null, bids: [[0, 0]], asks: [[0, 0]] };
    // ETH/USDT
    const { stdSymbol, bids, asks } = this.quotationPrice.getCoinUsdtOrderbook(
      ammContext.baseInfo.srcToken.address,
      ammContext.baseInfo.srcToken.chainId,
    );
    if (stdSymbol === null) {
      logger.error(`获取orderbook失败无法计算价格`, "calculatePrice_bs");
      throw "获取orderbook失败无法计算价格";
    }
    logger.info("get orderbook ", stdSymbol);
    const [[price]] = bids;
    const priceBn = new BigNumber(price);

    const targetPriceBN = priceBn.times(new BigNumber(0.997));
    Object.assign(sourceObject.quote_data, {
      orderbook: {
        A: { bids, asks },
        B: null,
      },
    });
    var_dump(sourceObject.quote_data);
    return [targetPriceBN.toString(), priceBn.toString()];
  }

  private calculatePrice_ss(
    ammContext: AmmContext,
    sourceObject: any = undefined,
  ): [string, string] {
    // return { stdSymbol: null, bids: [[0, 0]], asks: [[0, 0]] };
    // ETH/USDT

    const priceBn = new BigNumber(1);
    const targetPriceBN = priceBn.times(new BigNumber(0.997));
    Object.assign(sourceObject.quote_data, {
      orderbook: {},
    });
    var_dump(sourceObject.quote_data);
    return [targetPriceBN.toString(), priceBn.toString()];
  }

  private calculatePrice_11(
    ammContext: AmmContext,
    sourceObject: any = undefined,
  ): [string, string] {
    const priceBn = new BigNumber(1);
    const targetPriceBN = priceBn.times(new BigNumber(0.997));
    Object.assign(sourceObject.quote_data, {
      orderbook: {},
    });
    var_dump(sourceObject.quote_data);
    return [targetPriceBN.toString(), priceBn.toString()];
  }

  private calculatePrice_sb(
    ammContext: AmmContext,
    sourceObject: any = undefined,
  ): [string, string] {
    // return { stdSymbol: null, bids: [[0, 0]], asks: [[0, 0]] };
    // ETH/USDT
    const { stdSymbol, bids, asks } = this.quotationPrice.getCoinUsdtOrderbook(
      ammContext.baseInfo.dstToken.address,
      ammContext.baseInfo.dstToken.chainId,
    );
    if (stdSymbol === null) {
      logger.error(`获取orderbook失败无法计算价格`, "calculatePrice_bs");
      throw "获取orderbook失败无法计算价格";
    }

    const [[price]] = asks;
    const dstTokenPriceBn = new BigNumber(price);
    const priceBn = new BigNumber(1).div(new BigNumber(price));

    const targetPriceBN = priceBn.times(new BigNumber(0.997));
    Object.assign(sourceObject.quote_data, {
      orderbook: {
        A: null,
        B: { bids, asks },
      },
    });
    var_dump(sourceObject.quote_data);
    return [
      targetPriceBN.toFixed(8)
        .toString(),
      dstTokenPriceBn.toFixed(8)
        .toString(),
    ];
  }

  private calculatePrice(
    ammContext: AmmContext,
    sourceObject: any = undefined,
  ): [string, string] {
    const swapType = this.getSwapType(ammContext);
    logger.info(`当前的swapType`, swapType);
    if (swapType === "bb") {
      // ETH-AVAX
      ammContext.quoteInfo.mode = "bb";
      return this.calculatePrice_bb(ammContext, sourceObject);
    }
    if (swapType === "bs") {
      // ETH-USDT
      ammContext.quoteInfo.mode = "bs";
      return this.calculatePrice_bs(ammContext, sourceObject);
    }
    if (swapType === "ss") {
      ammContext.quoteInfo.mode = "ss";
      return this.calculatePrice_ss(ammContext, sourceObject);
    }
    if (swapType === "11") {
      ammContext.quoteInfo.mode = "11";
      return this.calculatePrice_11(ammContext, sourceObject);
    }
    if (swapType === "sb") {
      ammContext.quoteInfo.mode = "sb";
      return this.calculatePrice_sb(ammContext, sourceObject);
    }
    throw new Error("没有实现的交换");
  }

  private async min_amount(ammContext: AmmContext, sourceObject: any) {
    // 获取目标币的U价格

    const { bids: bid } = this.quotationPrice.getCoinUsdtOrderbook(
      ammContext.baseInfo.dstToken.address,
      ammContext.baseInfo.dstToken.chainId,
    );
    const { bids: sbid } = this.quotationPrice.getCoinUsdtOrderbook(
      ammContext.baseInfo.srcToken.address,
      ammContext.baseInfo.srcToken.chainId,
    );
    const tokenPrice = new BigNumber(bid[0][0])
      .div(new BigNumber(sbid[0][0]))
      .toFixed(8)
      .toString();
    const [usdPrice] = bid;
    if (usdPrice[0] === 0) {
      return "0";
    }
    // 需要扣除的币个数
    const coinCount = new BigNumber(gas.getGasUsd()).div(
      new BigNumber(usdPrice[0]),
    );
    let minCount = ``;
    if (coinCount.gt(new BigNumber(1))) {
      minCount = coinCount.div("0.003")
        .times(tokenPrice)
        .toFixed(8)
        .toString();
      console.table({
        gasCos: `${coinCount.toString()} == $${gas.getGasUsd()}`,
        usdPrice,
        minCount,
      });
    } else {
      minCount = `0`;
    }
    const minCountNumber = Number(minCount);
    const hedgeMinNumber = await this.min_amount_hedge(ammContext);
    const minAmount = _.max([minCountNumber, hedgeMinNumber]);
    if (!minAmount) {
      throw new Error("Minimum volume calculation error");
    }
    Object.assign(sourceObject.quote_data, {
      min_amount: new BigNumber(minAmount).toString(),
    });
  }

  private async min_amount_hedge(ammContext: AmmContext): Promise<number> {
    const hedgeType = dataConfig.getHedgeConfig().hedgeType;
    if (hedgeType === IHedgeType.Null) {
      return -1;
    }
    const minUsd = await hedgeManager.getHedgeIns(hedgeType)
      .getMinUsdAmount();
    if (minUsd === 0) {
      return -1;
    }
    const { stdSymbol, bids } = this.quotationPrice.getCoinUsdtOrderbook(
      ammContext.baseInfo.srcToken.address,
      ammContext.baseInfo.srcToken.chainId,
    );
    if (!stdSymbol) {
      throw "Unable to calculate left minimum,empty order book";
    }
    const [[price]] = bids;
    if (!_.isFinite(price)) {
      throw "Unable to get the price of the left currency";
    }
    // 多少个左侧币对，才能满足最小下单量
    const minLeftCoinInput = Number(
      new BigNumber(minUsd).div(new BigNumber(price))
        .toFixed(8)
        .toString(),
    );
    if (!_.isFinite(minLeftCoinInput)) {
      throw "Minimum volume calculation error";
    }
    logger.debug(`最小交易量${minLeftCoinInput}才能满足对冲条件`);
    return minLeftCoinInput;
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
  private calculateGas(ammContext: AmmContext, sourceObject: any) {
    // 获取目标币的U价格
    const { bids: bid } = this.quotationPrice.getCoinUsdtOrderbook(
      ammContext.baseInfo.dstToken.address,
      ammContext.baseInfo.dstToken.chainId,
    );
    const [[usdPrice]] = bid;
    if (usdPrice === 0) {
      return "0";
    }
    // 需要扣除的币个数
    const coinCount = new BigNumber(gas.getGasUsd()).div(
      new BigNumber(usdPrice),
    );

    Object.assign(sourceObject.quote_data, {
      gas: coinCount.toFixed(8)
        .toString(),
      gas_usd: gas.getGasUsd(),
    });
  }

  private async renderInfo(ammContext: AmmContext, sourceObject: any) {
    const [{ symbol: token0 }, { symbol: token1 }] =
      dataConfig.getCexStdSymbolInfoByToken(
        ammContext.baseInfo.srcToken.address,
        ammContext.baseInfo.dstToken.address,
        ammContext.baseInfo.srcToken.chainId,
        ammContext.baseInfo.dstToken.chainId,
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
  private async calculateCapacity(ammContext: AmmContext, sourceObject: any) {
    if (dataConfig.getHedgeConfig().hedgeType === IHedgeType.Null) {
      return;
    }
    const capacity = await hedgeManager
      .getHedgeIns(dataConfig.getHedgeConfig().hedgeType)
      .calculateCapacity(ammContext);
    // ETH-USDT // min(能卖出的最大对冲量,目标链钱包最大余额)
    // USDT-ETH // min(目标链钱包的最大余额)
    // USDT-USDT // min(目标链钱包的最大余额)
    // ETH-ETH // min(目标链钱包的最大余额)
    // const capacity16 = new BigNumber(capacity).toString(16);
    // const capacity16Str = `0x${capacity16}`;
    logger.debug(
      `最大价格应该报价为`,
      new BigNumber(capacity).toFixed(8)
        .toString(),
    );
    const etherWei = web3.utils.toWei(
      new BigNumber(capacity).toFixed(8)
        .toString(),
      "ether",
    );
    _.assign(sourceObject.quote_data, {
      capacity_num: new BigNumber(capacity).toFixed(8)
        .toString(),
      capacity: `0x${etherWei}`,
    });
  }

  private async analysis(ammContext: AmmContext, sourceObject: any) {
    const max = _.get(sourceObject, "quote_data.capacity_num", 0);
    const input = ammContext.swapInfo.inputAmountNumber;
    if (max <= input) {
      logger.warn("The quotation has expired, and the maximum quantity is not enough to meet the input requirement.");
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
