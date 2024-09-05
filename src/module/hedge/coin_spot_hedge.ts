/* eslint-disable arrow-parens */
import _ from "lodash";
import { dataConfig } from "../../data_config";
import {
  ICoinType,
  IHedgeClass,
  IHedgeType,
  ISpotHedgeInfo,
} from "../../interface/interface";
import { logger } from "../../sys_lib/logger";
import { accountManager } from "../exchange/account_manager";
import BigNumber from "bignumber.js";
import { AmmContext } from "../../interface/context";
import { balanceLockModule } from "../../mongo_module/balance_lock";
import { CoinSpotHedgeBase } from "./coin_spot_hedge_base";
import { CoinSpotHedgeWorker } from "./coin_spot_hedge_worker";
import { EthUnit } from "../../utils/eth";
import { SystemMath } from "../../utils/system_math";
import { ConsoleDirDepth5 } from "../../utils/console";
import {
  // ICexExchangeList,
  IOrderExecModel,
  ISpotOrderResult,
} from "../../interface/std_difi";
import { AsyncOrderMonitor } from "./async_order_monitor";
import { SysMongoQueue } from "../../sys_lib/mongo_queue";

const stringify = require("json-stringify-safe");
const { ethers } = require("ethers");
const appName = _.get(process.env, "APP_NAME", undefined);
if (!appName) {
  throw new Error(`Queue name is incorrectly configured`);
}
const queueName = `SYSTEM_HEDGE_QUEUE_${appName}`;
const hedgeQueue = new SysMongoQueue(queueName);

/**
 * coin spot Hedged
 */
class CoinSpotHedge extends CoinSpotHedgeBase implements IHedgeClass {
  // @ts-ignore
  // private accountStatus = 0;
  public worker: CoinSpotHedgeWorker = new CoinSpotHedgeWorker();
  public asyncOrderMonitor: AsyncOrderMonitor = new AsyncOrderMonitor();
  public constructor() {
    logger.info("init CoinSpotHedge");
    super();
    logger.info("CoinSpotHedge loaded");
  }

  public async init() {
    logger.debug(`Start consuming the hedging queue......`);

    // Start processing the hedge queue
    hedgeQueue.process(async (job, done) => {
      try {
        await this.worker.worker(job.data);
        done();
      } catch (e) {
        const err: any = e;
        done(new Error(err.toString()));
        logger.error(`An error occurred while processing the queue`, e);
      }
    });
    if (
      dataConfig.getHedgeConfig().hedgeType === IHedgeType.CoinSpotHedge &&
      dataConfig.getHedgeConfig().hedgeAccount !== ""
    ) {
      logger.info(
        `initialize hedgeAccount account`,
        dataConfig.getHedgeConfig().hedgeAccount
      );
      await this.initAccount();
    } else {
      logger.debug(`no hedging required`);
      return;
    }
    const accountIns = accountManager.getAccount(
      dataConfig.getHedgeConfig().hedgeAccount
    );
    if (!accountIns) {
      throw `account ins not initialized`;
    }
    if (accountIns.order.getSpotExecModel() === IOrderExecModel.ASYNC) {
      accountIns
        .getCexExchange()
        // @ts-ignore
        .on("spot_order_close", (orderData: ISpotOrderResult | undefined) => {
          logger.debug(`forward event to asyncOrderMonitor 🍄`);
          this.asyncOrderMonitor.onOrder(orderData);
        });
      accountIns
        .getCexExchange()
        // @ts-ignore
        .on("client_spot_create_order", (orderId: string, orderData: any) => {
          logger.debug(
            `forward event to asyncOrderMonitor create event client create order `
          );
          this.asyncOrderMonitor.onClientCreateOrder(orderId, orderData);
        });
      accountIns
        .getCexExchange()
        // @ts-ignore
        .on("spot_order_create_rejected", (orderId: string, rawData: any) => {
          this.asyncOrderMonitor.onOrderFail(orderId, rawData);
        });
    }
  }

  public getHedgeFeeSymbol(): string {

    const accountIns = accountManager.getAccount(
      dataConfig.getHedgeConfig().hedgeAccount
    );
    if (!accountIns) {
      throw `account ins not initialized`;
    }
    // const exchangeName = accountIns.getExchangeName();
    // if (exchangeName === ICexExchangeList.binance) {
    //   return "BNB";
    // }
    const symbol = dataConfig.getHedgeConfig().feeSymbol
    if (symbol === "") {
      throw "Please configure feeSymbol.";
    }
    return symbol;
  }

  private async initAccount() {
    try {
      await accountManager.init();
      // this.accountStatus = 1;
      logger.info(`account has been initialized`);
    } catch (e) {
      logger.error(e);
    }
  }

  /**
   * check srcTokenBalance on hedge account
   * @date 2023/4/13 - 15:04:07
   *
   * @public
   * @async
   * @param {AmmContext} ammContext "context"
   * eth-usdt  cex There must be enough | sell eth
   * usdt-eth  cex There must be enough usdt | buy eth
   * eth-avax  cex There must be enough eth | ell eth  bue avax
   * eth-eth   not limited
   * usdt-usdt not limited
   * @returns {*} bool or throw
   */
  public async checkSwapAmount(ammContext: AmmContext) {
    const skipMode = ["11", "ss"];
    if (skipMode.includes(ammContext.quoteInfo.mode)) {
      logger.debug(`No swapAmount check,mode:${ammContext.quoteInfo.mode}`);
      return true;
    }
    const symbol = ammContext.baseInfo.srcToken.symbol;
    if (symbol === "T") {
      return true;
    }
    const balance = accountManager
      .getAccount(dataConfig.getHedgeConfig().hedgeAccount)
      ?.balance.getSpotBalance(symbol);
    if (!balance) {
      throw new Error(`failed to get balance`);
    }
    const free = Number(balance.free);
    const inputAmount = ammContext.swapInfo.inputAmountNumber;
    if (free > inputAmount) {
      return true;
    }
    logger.debug({
      type: "userBalance",
      symbol,
      balance,
      accountId: dataConfig.getHedgeConfig().hedgeAccount,
    });
    logger.warn(`【${symbol}】not enough balance,User input:${inputAmount} `);
    throw new Error(`not enough balance`);
  }

  public async checkMinHedge(
    ammContext: AmmContext,
    srcUnitPrice: number,
    dstUnitPrice: number
  ): Promise<boolean> {
    const stdSymbol = this.getOptStdSymbol(ammContext);
    if (stdSymbol === false) {
      logger.debug(
        ammContext.bridgeItem.std_symbol,
        "No hedging required, skip"
      );
      return true;
    }
    logger.debug("get account", dataConfig.getHedgeConfig().hedgeAccount);
    const accountIns = accountManager.getAccount(
      dataConfig.getHedgeConfig().hedgeAccount
    );
    if (!accountIns) {
      throw new Error(`Account instance not found`);
    }
    const [amount, value] = this.getOptAmountAndValue(
      ammContext,
      srcUnitPrice,
      dstUnitPrice
    );
    logger.debug(`Enter total value ,amount [${amount}] value [${value}] `);
    if (amount === -1 && value === -1) {
      logger.warn(`mode no hedging condition check required`);
      return true;
    }
    if (!(await accountIns.order.spotTradeCheck(stdSymbol, value, amount))) {
      throw new Error("Execution condition not met");
    }
    return false;
  }

  public async getMinHedgeAmount(
    ammContext: AmmContext,
    srcPrice: number,
    dstPrice: number,
    gasTokenPrice: number
  ): Promise<number> {
    const accountIns = accountManager.getAccount(
      dataConfig.getHedgeConfig().hedgeAccount
    );
    if (!accountIns) {
      throw new Error(`Account instance not found`);
    }
    let ret = { min: 0, swapGasTokenMin: 0 };
    const gasTokenMinNotional = await accountIns.order.spotGetTradeMinNotional(
      `${ammContext.baseInfo.dstChain.tokenName}/USDT`
    );
    const srcTokenMinNotional = await accountIns.order.spotGetTradeMinNotional(
      `${ammContext.baseInfo.srcToken.symbol}/USDT`
    );
    const dstTokenMinNotional = await accountIns.order.spotGetTradeMinNotional(
      `${ammContext.baseInfo.dstToken.symbol}/USDT`
    );
    if (ammContext.quoteInfo.mode === "11") {
      ret = {
        min: SystemMath.execNumber(
          `${srcTokenMinNotional}*2/${srcPrice}*100.3%`
        ),
        swapGasTokenMin: SystemMath.execNumber(
          `${gasTokenMinNotional}/${srcPrice}`
        ),
      };
    }
    if (ammContext.quoteInfo.mode === "ss") {
      ret = {
        min: 0,
        swapGasTokenMin: SystemMath.execNumber(
          `${gasTokenMinNotional}/${srcPrice}*100.3%`
        ),
      };
    }
    if (ammContext.quoteInfo.mode === "bs") {
      ret = {
        min: SystemMath.execNumber(`${srcTokenMinNotional}/${srcPrice}*100.3%`),
        swapGasTokenMin: SystemMath.execNumber(
          `${gasTokenMinNotional}/${srcPrice}*100.3%`
        ),
      };
    }
    if (ammContext.quoteInfo.mode === "sb") {
      ret = {
        min: SystemMath.execNumber(`${dstTokenMinNotional}/${srcPrice}*100.3%`),
        swapGasTokenMin: SystemMath.execNumber(
          `${gasTokenMinNotional}/${srcPrice}*100.3%`
        ),
      };
    }
    if (ammContext.quoteInfo.mode === "bb") {
      ret = {
        min: ((): any => {
          const a = SystemMath.execNumber(
            `${dstTokenMinNotional}/${srcPrice}*100.3%`
          );
          const b = SystemMath.execNumber(
            `${srcTokenMinNotional}/${srcPrice}*100.3%`
          );
          return SystemMath.execNumber(`${a}+${b}`);
        })(),
        swapGasTokenMin: SystemMath.execNumber(
          `${gasTokenMinNotional}/${srcPrice}`
        ),
      };
    }
    return SystemMath.execNumber(`${ret.min}+${ret.swapGasTokenMin}`);
  }

  public async getHedgeAccountState() {
    return 0;
  }

  public async getSwapMax(): Promise<BigNumber> {
    return new BigNumber(0);
  }

  /**
   * Description Create balance lock
   * @date 2023/2/10 - 14:47:48
   *
   * @public
   * @async
   * @param {AmmContext} ammContext ""
   * @param {string} accountId ""
   * @returns {Promise<number>} ""
   */
  public async lockHedgeBalance(
    ammContext: AmmContext,
    accountId: string
  ): Promise<string> {
    const [symbol0] = dataConfig.getCexStdSymbolInfoByToken(
      ammContext.baseInfo.srcToken.address,
      ammContext.baseInfo.dstToken.address,
      ammContext.baseInfo.srcToken.chainId,
      ammContext.baseInfo.dstToken.chainId
    );
    let balanceLockedId = "";

    const lockResult = {
      ammName: ammContext.appName,
      accountId,
      asset: symbol0.symbol,
      quoteHash: ammContext.quoteInfo.quote_hash,
      lockedTime: new Date().getTime(),
      locked: await this.getAmount(
        ammContext.swapInfo.srcAmount,
        symbol0.precision
      ),
    };
    logger.info(`lock balance`);
    logger.info(lockResult);
    balanceLockedId = await this.createLockRecord(lockResult);

    return balanceLockedId;
  }

  /**
   * Description swap amount，left
   * @date 2023/2/10 - 14:22:08
   *
   * @private
   * @async
   * @param {string} amountStr "orig amount"
   * @param {number} precision "precision"
   * @returns {Promise<number>} "lock Amount"
   */
  private async getAmount(
    amountStr: string,
    precision: number
  ): Promise<number> {
    if (!_.isFinite(precision)) {
      throw new Error("lock balance get precision error");
    }

    const lockCount = Number(
      new BigNumber(EthUnit.fromWei(amountStr, precision)).toFixed(8).toString()
    );
    if (!_.isFinite(lockCount)) {
      throw new Error("lock balance number error");
    }
    logger.info(`lock ${lockCount} from user cex balance`);
    return lockCount;
  }

  /**
   * Description Create a balance lock, the current index data is empty
   * @date 2023/2/14 - 14:13:28
   *
   * @private
   * @async
   * @param {*} record "data"
   * @returns {Promise<number>} "pk"
   */
  private async createLockRecord(record: any): Promise<string> {
    const accountId = _.get(record, "accountId", "");
    const quoteHash = _.get(record, "quoteHash");
    const ammName = _.get(record, "ammName", "");
    logger.info("write lock record");
    const insertData = await balanceLockModule.create({
      ammName,
      accountId,
      quoteHash,
      record,
    });
    return insertData._id.toHexString();
  }

  /**
   * DescriptionWhen checking whether there are enough conditions to complete the hedging Lock lock, for example, if the hedging is configured, but there are not enough coins, it should stop
   * @date 1/31/2023 - 7:42:44 PM
   *
   * @public
   * @param {AmmContext} ammContext "ammContext data"
   * @returns {boolean} ""
   */
  public async checkHedgeCond(ammContext: AmmContext): Promise<boolean> {
    const cexSymbol = dataConfig.getCexStdSymbolInfoByToken(
      ammContext.baseInfo.srcToken.address,
      ammContext.baseInfo.dstToken.address,
      ammContext.baseInfo.srcToken.chainId,
      ammContext.baseInfo.dstToken.chainId
    );
    if (!cexSymbol) {
      logger.error(`Unable to find the corresponding Cex currency pair`);
      return false;
    }
    if (cexSymbol[0].symbol === cexSymbol[1].symbol) {
      // Same currency exchange, no hedging required
      return true;
    }
    if (cexSymbol[0].coinType === cexSymbol[1].coinType) {
      // At present, only considering the stable currency, if you can figure it out, you can exchange it directly without hedging
      return true;
    }

    const amount = ethers.formatEther(ammContext.swapInfo.srcAmount);
    const srcTokenCountBn = new BigNumber(amount);
    const accountIns = accountManager.getAccount(
      dataConfig.getHedgeConfig().hedgeAccount
    );
    if (!accountIns) {
      return false;
    }
    const cexBalance = accountIns.balance.getSpotBalance(cexSymbol[0].symbol);
    const cexBalanceBn = new BigNumber(cexBalance.free);
    const cexBalanceLockedBn = await this.getLockedBalance(
      // account locked balance
      dataConfig.getHedgeConfig().hedgeAccount,
      cexSymbol[0].symbol
    );
    if (cexBalanceBn.minus(cexBalanceLockedBn).lt(srcTokenCountBn)) {
      logger.info(
        `calculation formula: ${cexBalanceBn
          .toFixed(8)
          .toString()}-${cexBalanceLockedBn
          .toFixed(8)
          .toString()}>${srcTokenCountBn.toString()}`
      );
      //  if cex balance lt swap amount  return false
      logger.warn(
        `symbol:[${
          cexSymbol[0].symbol
        }] Insufficient balance for hedging Cex:${cexBalanceBn
          .toFixed(8)
          .toString()} amount:${srcTokenCountBn.toFixed(8).toString()}`
      );
      return false;
    }
    return true;
  }

  public async preExecOrder(ammContext: AmmContext): Promise<boolean> {
    const accountIns = accountManager.getAccount(
      dataConfig.getHedgeConfig().hedgeAccount
    );
    if (!accountIns) {
      logger.error(`account ins not found`);
      return false;
    }
    try {
      const orderList = await this.worker.prepareOrder(ammContext);
      console.log(`orders requiring pre-execution`);
      console.dir(orderList, ConsoleDirDepth5);
      // await this.worker.simulationExec(orderList);
      return true;
    } catch (e) {
      logger.error(`simulation order execute error`, e);
      return false;
    }
  }

  public async getLockedBalance(
    accountId: string,
    symbol: string
  ): Promise<BigNumber> {
    logger.debug(accountId, symbol);
    let locked = new BigNumber(0);
    const result = await balanceLockModule
      .find({
        accountId,
        "record.asset": symbol,
      })
      .lean();
    logger.warn(`Found ${result.length} locked records`);
    result.forEach((item) => {
      locked = locked.plus(new BigNumber(item.record.locked));
    });
    logger.warn(accountId, "locked balance", locked.toString());
    return locked;
  }

  /**
   * Description The maximum value used to calculate quotes
   *
   * @date 2/1/2023 - 5:08:58 PM
   * @public
   * @param {AmmContext} ammContext item
   * @async
   * @returns {Promise<number>} "Quote Max"
   */
  public async calculateCapacity(ammContext: AmmContext): Promise<number> {
    const tokenInfo = dataConfig.getCexStdSymbolInfoByToken(
      ammContext.baseInfo.srcToken.address,
      ammContext.baseInfo.dstToken.address,
      ammContext.baseInfo.srcToken.chainId,
      ammContext.baseInfo.dstToken.chainId
    );
    if (!tokenInfo) {
      logger.error(`The correct symbol information was not found`);
      throw new Error(`The correct symbol information was not found`);
    }

    if (
      tokenInfo[0].coinType === ICoinType.StableCoin &&
      tokenInfo[1].coinType === ICoinType.StableCoin
    ) {
      return this.calculateCapacity_ss(ammContext);
    }
    if (tokenInfo[0].symbol === tokenInfo[1].symbol) {
      // 1:1
      return this.calculateCapacity_11(ammContext);
    }

    if (
      tokenInfo[0].coinType === ICoinType.Coin &&
      tokenInfo[1].coinType === ICoinType.StableCoin
    ) {
      return await this.calculateCapacity_bs(ammContext);
    }
    if (
      tokenInfo[0].coinType === ICoinType.StableCoin &&
      tokenInfo[1].coinType === ICoinType.Coin
    ) {
      return await this.calculateCapacity_sb(ammContext);
    }
    // diff coin
    return await this.calculateCapacity_bb(ammContext);
  }

  private async calculateCapacity_sb(ammContext: AmmContext): Promise<number> {
    // usdt-eth
    const stdSymbol = `${ammContext.baseInfo.dstToken.symbol}/USDT`;
    const gasSymbol =
      ammContext.bridgeItem.symbol_info.getGasTokenStableStdSymbol(ammContext);
    const tokenInfo = this.getTokenInfoByAmmContext(ammContext);
    const accountIns = accountManager.getAccount(
      dataConfig.getHedgeConfig().hedgeAccount
    );
    if (!accountIns) {
      logger.error(`did not complete account initialization`);
      return 0;
    }
    const [, coinMaxValue] = await accountIns.order.getSpotTradeMinMaxValue(
      stdSymbol
    );
    const [, gasTokenCoinMaxValue] =
      await accountIns.order.getSpotTradeMinMaxValue(gasSymbol);
    const maxTradeValue = SystemMath.min([coinMaxValue, gasTokenCoinMaxValue]);
    const maxTradeCount = SystemMath.execNumber(
      `${maxTradeValue}/${ammContext.quoteInfo.src_usd_price}*99.7%`,
      "Maximum Transaction Size"
    );
    const srcTokenCexBalance = accountIns.balance.getSpotBalance(
      tokenInfo[0].symbol
    );
    if (!srcTokenCexBalance) {
      logger.error(
        `not getting the correct price symbol ${tokenInfo[0].symbol}`
      );
      return 0;
    }
    return SystemMath.min([Number(srcTokenCexBalance.free), maxTradeCount]);
  }

  public async calculateCapacity_bs(ammContext: AmmContext): Promise<number> {
    // ETH-USDT
    const stdSymbol = `${ammContext.baseInfo.srcToken.symbol}/USDT`;
    const tokenInfo = this.getTokenInfoByAmmContext(ammContext);
    const accountIns = accountManager.getAccount(
      dataConfig.getHedgeConfig().hedgeAccount
    );
    if (!accountIns) {
      logger.warn(`account ins init error`);
      return 0;
    }
    let [, maxTradeCount] = await accountIns.order.getSpotTradeMinMax(
      stdSymbol,
      SystemMath.execNumber(`${ammContext.quoteInfo.src_usd_price} *1`)
    );
    maxTradeCount = SystemMath.execNumber(`${maxTradeCount} * 99.7%`);
    const srcTokenCexBalanceInfo = accountIns.balance.getSpotBalance(
      tokenInfo[0].symbol
    );
    if (!srcTokenCexBalanceInfo || srcTokenCexBalanceInfo.free === "0") {
      logger.warn(`Cex has no balance`, tokenInfo[0].symbol);
      return 0;
    }
    const srcTokenCexBalance = Number(srcTokenCexBalanceInfo.free);
    if (!_.isFinite(srcTokenCexBalance)) {
      logger.warn(`Cex has no balance`, tokenInfo[0].symbol);
      return 0;
    }
    const minCount: any = SystemMath.min([srcTokenCexBalance, maxTradeCount]);
    logger.debug(`spot hedge maximum supply `, {
      srcTokenCexBalance,
      maxTradeCount,
      minCount,
    });
    return minCount;
  }

  public async calculateCapacity_11(ammContext: AmmContext): Promise<number> {
    const accountIns = accountManager.getAccount(
      dataConfig.getHedgeConfig().hedgeAccount
    );
    if (!accountIns) {
      logger.warn(`account ins not initialized`);
      return 0;
    }
    const stdSymbol =
      ammContext.bridgeItem.symbol_info.getSrcStableStdSymbol(ammContext);
    const gasSymbol =
      ammContext.bridgeItem.symbol_info.getGasTokenStableStdSymbol(ammContext);
    const [, coinMaxValue] = await accountIns.order.getSpotTradeMinMaxValue(
      stdSymbol
    );
    const [, gasTokenCoinMaxValue] =
      await accountIns.order.getSpotTradeMinMaxValue(gasSymbol);
    const maxTradeValue = SystemMath.min([coinMaxValue, gasTokenCoinMaxValue]);
    const maxTradeCount = SystemMath.execNumber(
      `${maxTradeValue}/${ammContext.quoteInfo.src_usd_price}*99.7%`
    );

    const tokenInfo = this.getTokenInfoByAmmContext(ammContext);
    const srcTokenCexBalanceInfo = accountIns.balance.getSpotBalance(
      tokenInfo[0].symbol
    );
    if (!srcTokenCexBalanceInfo || srcTokenCexBalanceInfo.free === "0") {
      logger.warn(`Cex has no balance`, tokenInfo[0].symbol);
      return 0;
    }
    const srcTokenCexBalance = Number(srcTokenCexBalanceInfo.free);
    if (!_.isFinite(srcTokenCexBalance)) {
      logger.warn(`Cex has no balance`, tokenInfo[0].symbol);
      return 0;
    }
    const minCount: any = _.min([srcTokenCexBalance, maxTradeCount]);
    return minCount;
  }

  private async calculateCapacity_ss(ammContext: AmmContext): Promise<number> {
    const gasSymbol =
      ammContext.bridgeItem.symbol_info.getGasTokenStableStdSymbol(ammContext);

    const tokenInfo = this.getTokenInfoByAmmContext(ammContext);
    const accountIns = accountManager.getAccount(
      dataConfig.getHedgeConfig().hedgeAccount
    );
    if (!accountIns) {
      logger.error(`did not complete account initialization`);
      return 0;
    }
    const [, gasTokenCoinMaxValue] =
      await accountIns.order.getSpotTradeMinMaxValue(gasSymbol);
    const maxTradeValue = SystemMath.min([gasTokenCoinMaxValue]);
    const maxTradeCount = SystemMath.execNumber(
      `${maxTradeValue}/${ammContext.quoteInfo.src_usd_price}*99.7%`
    );

    const srcTokenCexBalanceInfo = accountIns.balance.getSpotBalance(
      tokenInfo[0].symbol
    );
    if (!srcTokenCexBalanceInfo || srcTokenCexBalanceInfo.free === "0") {
      logger.warn(`Cex has no balance`, tokenInfo[0].symbol);
      return 0;
    }
    const srcTokenCexBalance = Number(srcTokenCexBalanceInfo.free);
    if (!_.isFinite(srcTokenCexBalance)) {
      logger.warn(`Cex has no balance`, tokenInfo[0].symbol);
      return 0;
    }
    return SystemMath.min([srcTokenCexBalance, maxTradeCount]);
  }

  private async calculateCapacity_bb(ammContext: AmmContext): Promise<number> {
    const accountIns = accountManager.getAccount(
      dataConfig.getHedgeConfig().hedgeAccount
    );
    if (!accountIns) {
      logger.error(`did not complete account initialization`);
      return 0;
    }
    const aStdSymbol =
      ammContext.bridgeItem.symbol_info.getSrcStableStdSymbol(ammContext);
    const bStdSymbol =
      ammContext.bridgeItem.symbol_info.getDstStableStdSymbol(ammContext);
    const gasSymbol =
      ammContext.bridgeItem.symbol_info.getGasTokenStableStdSymbol(ammContext);
    const [, aCoinMaxValue] = await accountIns.order.getSpotTradeMinMaxValue(
      aStdSymbol
    );
    const [, bCoinMaxValue] = await accountIns.order.getSpotTradeMinMaxValue(
      bStdSymbol
    );
    const [, gasTokenCoinMaxValue] =
      await accountIns.order.getSpotTradeMinMaxValue(gasSymbol);
    const maxTradeValue = SystemMath.min([
      aCoinMaxValue,
      bCoinMaxValue,
      gasTokenCoinMaxValue,
    ]);
    const maxTradeCount = SystemMath.execNumber(
      `${maxTradeValue}/${ammContext.quoteInfo.src_usd_price}*99.7%`
    );
    const tokenInfo = this.getTokenInfoByAmmContext(ammContext);
    const srcTokenCexBalance = accountIns.balance.getSpotBalance(
      tokenInfo[0].symbol
    );
    const srcBalanceCount = Number(srcTokenCexBalance?.free);
    if (!srcBalanceCount || !_.isFinite(srcBalanceCount)) {
      return 0;
    }
    return SystemMath.min([srcBalanceCount, maxTradeCount]);
  }

  /**
   * Description Write hedging information to JOB
   * @date 2023/3/3 - 21:35:03
   *
   * @public
   * @async
   * @param {ISpotHedgeInfo} hedgeData ""
   * @returns {*} ""
   */
  public async hedge(hedgeData: ISpotHedgeInfo) {
    const hedgeInfo: ISpotHedgeInfo = JSON.parse(stringify(hedgeData));
    console.log("Basic Information on Current Hedging");
    this.writeJob(hedgeInfo).then(() => {
      logger.debug(`Already written to the hedged queue`, hedgeData.orderId);
    });
  }

  public async writeJob(hedgeInfo: ISpotHedgeInfo) {
    logger.info(`Write information to Job.....`);
    hedgeQueue.add(hedgeInfo);
  }
}

const coinSpotHedge: CoinSpotHedge = new CoinSpotHedge();

export { coinSpotHedge, CoinSpotHedge };
