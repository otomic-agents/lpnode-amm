/* eslint-disable arrow-parens */
import _ from "lodash";
import {dataConfig} from "../../data_config";
import {ICexCoinConfig, ICoinType, IHedgeClass, IHedgeType, ISpotHedgeInfo,} from "../../interface/interface";
import {logger} from "../../sys_lib/logger";
import {chainBalance} from "../chain_balance";
import {accountManager} from "../exchange/account_manager";
import BigNumber from "bignumber.js";
import {getRedisConfig} from "../../redis_bus";
import Bull from "bull";
import {quotationPrice} from "../quotation/quotation_price";
import {getNumberFrom16} from "../../utils/ethjs_unit";
import {AmmContext} from "../../interface/context";
import {balanceLockModule} from "../../mongo_module/balance_lock";
import {ammContextModule} from "../../mongo_module/amm_context";
import {createOrderId} from "../exchange/utils";

const {ethers} = require("ethers");
const redisConfig = getRedisConfig();
const hedgeQueue = new Bull("SYSTEM_HEDGE_QUEUE", {
  redis: {port: 6379, host: redisConfig.host, password: redisConfig.pass},
});

/**
 * coin spot Hedge
 */
class CoinSpotHedge implements IHedgeClass {
  // @ts-ignore
  private accountStatus = 0

  public constructor() {
    logger.info("CoinSpotHedge loaded.. ");
  }

  public async init() {
    logger.debug(`Start consuming the hedging queue......`);
    // Start processing the hedge queue
    hedgeQueue.process(async (job, done) => {
      try {
        await this.worker(job.data);
      } catch (e) {
        logger.error(`An error occurred while processing the queue`, e);
      } finally {
        done();
      }
    });
    if (dataConfig.getHedgeConfig().hedgeType === IHedgeType.CoinSpotHedge && dataConfig.getHedgeConfig().hedgeAccount !== "") {
      logger.info(`开始初始化账户，因为配置了对冲..`)
      await this.initAccount();
    }

  }

  private async initAccount() {
    try {
      await accountManager.init();
      this.accountStatus = 1
      logger.info(`账号已经初始化完毕，可以正常处理报价了.`)
    } catch (e) {
      logger.error(e)
    }

  }


  public async getHedgeAccountState() {
    return 0
  }

  public async getSwapMax(): Promise<BigNumber> {
    return new BigNumber(0)
  }

  private async worker(call: { orderId: number; ammContext: AmmContext }) {
    await this.freeBalanceLock(call);
    const side = this.getSide(call.ammContext);
    const coinInfo: any = [
      call.ammContext.baseInfo.srcToken,
      call.ammContext.baseInfo.dstToken,
    ];
    const stdSymbol = this.getStdSymbol(coinInfo);
    const accountIns = await accountManager.getAccount(
        dataConfig.getHedgeConfig().hedgeAccount
    );
    try {
      if (!accountIns) {
        throw new Error(
            `No instance of hedging account was found.AccountId:${
                dataConfig.getHedgeConfig().hedgeAccount
            }`
        );
      }
      const storeData: any = {};
      try {
        let execFun = "spotBuy";
        if (side === "SELL") {
          execFun = "spotSell";
        }
        logger.debug(`exec hedge, Action [${execFun}]`);
        console.log(
            "spot",
            stdSymbol,
            side,
            this.getCexAmount(call.ammContext, side)
        );
        storeData.orderInfo = await accountIns.order[execFun](
            createOrderId("spot", 1, Number(new BigNumber("1000"))),
            stdSymbol,
            this.getCexAmount(call.ammContext, side)
        );
      } catch (e) {
        const err: any = e;
        storeData.orderInfo = {};
        storeData.status = 0;
        storeData.errorMessage = err.toString();
        throw e;
      } finally {
        await ammContextModule.findOneAndUpdate(
            {
              "systemOrder.orderId": call.ammContext.systemOrder.orderId,
            },
            {
              $set: {
                "systemOrder.cexResult": storeData,
              },
            }
        );
      }
    } catch (e) {
      logger.error(
          `An error occurred when placing an order, and hedging failed..${e}`
      );
    }
  }

  private getCexAmount(ammContext: AmmContext, side: string): number {
    if (side === "BUY") {
      const amount = ammContext.swapInfo.dstAmountNumber;
      if (!_.isFinite(amount)) {
        throw "Miscalculation of hedging amount";
      }
      return amount;
    }
    if (side === "SELL") {
      const amount = ammContext.swapInfo.srcAmountNumber;
      if (!_.isFinite(amount)) {
        throw "Miscalculation of hedging amount";
      }
      return amount;
    }
    throw new Error("Unknown side");
  }

  public async getMinUsdAmount(): Promise<number> {
    return 20;
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
    const [symbol0, symbol1] = dataConfig.getCexStdSymbolInfoByToken(
        ammContext.baseInfo.srcToken.address,
        ammContext.baseInfo.dstToken.address,
        ammContext.baseInfo.srcToken.chainId,
        ammContext.baseInfo.dstToken.chainId
    );
    let balanceLockedId = "";
    if (
        symbol0.coinType === ICoinType.Coin &&
        symbol1.coinType === ICoinType.StableCoin
    ) {
      const lockResult = {
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
    }
    if (
        symbol0.coinType === ICoinType.StableCoin &&
        symbol1.coinType === ICoinType.Coin
    ) {
      const lockResult = {
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
    }
    return balanceLockedId;
  }

  public async freeBalanceLock(call: {
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

  /**
   * Description swap amount，left
   * @date 2023/2/10 - 14:22:08
   *
   * @private
   * @async
   * @param {string} amountStr "原始的量"
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
        new BigNumber(getNumberFrom16(amountStr, precision)).toFixed(8).toString()
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
    logger.info("write lock record");
    const insertData = await balanceLockModule.create({
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
          `计算公式${cexBalanceBn.toFixed(8).toString()}-${cexBalanceLockedBn
              .toFixed(8)
              .toString()}>${srcTokenCountBn.toString()}`
      );
      //  if cex balance lt swap amount  return false
      logger.warn(
          `Insufficient balance for hedging Cex:${cexBalanceBn
              .toFixed(8)
              .toString()} amount:${srcTokenCountBn.toFixed(8).toString()}`
      );
      return false;
    }
    return true;
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
    logger.warn(`找到了${result.length}条锁定记录`);
    result.forEach((item) => {
      locked = locked.plus(new BigNumber(item.record.locked));
    });
    logger.warn(accountId, "已经锁定的余额", locked.toString());
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
    // ETH-USDT //  min(The maximum amount sold ETH,目标链钱包最大余额价值多少 ETH)
    // USDT-ETH // min(目标链钱包的最大余额,ETH, USDT 能购买的最大ETH量)
    // USDT-USDT // min(目标链钱包的最大余额)
    // ETH-ETH // min(目标链钱包的最大余额)
    // ETH-AVAX // 还没有计算
    // 目标Token ，在链上的最大余额
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

  private async calculateCapacity_sb(ammContext: AmmContext) {
    // usdt-eth
    const tokenInfo = dataConfig.getCexStdSymbolInfoByToken(
        ammContext.baseInfo.srcToken.address,
        ammContext.baseInfo.dstToken.address,
        ammContext.baseInfo.srcToken.chainId,
        ammContext.baseInfo.dstToken.chainId
    );
    const srcTokenCexBalance = accountManager
        .getAccount(dataConfig.getHedgeConfig().hedgeAccount)
        ?.balance.getSpotBalance(tokenInfo[0].symbol);
    if (!srcTokenCexBalance) {
      logger.error(
          `not getting the correct price symbol ${tokenInfo[0].symbol}`
      );
      return 0;
    }
    const dstTokenBalance = chainBalance.getBalance(
        ammContext.baseInfo.dstToken.chainId,
        ammContext.walletInfo.walletName,
        ammContext.baseInfo.dstToken.address
    );
    const {
      asks: [[price]],
    } = quotationPrice.getCoinUsdtOrderbook(
        ammContext.baseInfo.dstToken.address,
        ammContext.baseInfo.dstToken.chainId
    );
    if (!_.isFinite(Number(price)) || Number(price) === 0) {
      logger.error(`Did not get the correct orderbook price`);
      return 0;
    }
    const maxCountBN = new BigNumber(srcTokenCexBalance.free) // 能买多少个目标币
        .div(new BigNumber(price))
        .toFixed(8)
        .toString();
    const maxCount = Number(maxCountBN);
    if (!_.isFinite(maxCount) || maxCount === 0) {
      logger.error(`MaxCount calculation failed`);
      return 0;
    }
    // Cex UHow many target coins can be purchased and the minimum balance of target coins
    const retMaxCount = _.min([maxCount, dstTokenBalance]);
    return retMaxCount;
  }

  public async calculateCapacity_bs(ammContext: AmmContext): Promise<number> {
    // ETH-USDT
    const tokenInfo = dataConfig.getCexStdSymbolInfoByToken(
        ammContext.baseInfo.srcToken.address,
        ammContext.baseInfo.dstToken.address,
        ammContext.baseInfo.srcToken.chainId,
        ammContext.baseInfo.dstToken.chainId
    );

    const dstTokenBalance = chainBalance.getBalance(
        ammContext.baseInfo.dstToken.chainId,
        ammContext.walletInfo.walletName,
        ammContext.baseInfo.dstToken.address
    );
    const srcTokenCexBalanceInfo = accountManager
        .getAccount(dataConfig.getHedgeConfig().hedgeAccount)
        ?.balance.getSpotBalance(tokenInfo[0].symbol);
    if (!srcTokenCexBalanceInfo || srcTokenCexBalanceInfo.free === "0") {
      logger.warn(`Cex has no balance`, tokenInfo[0].symbol);
      return 0;
    }
    const srcTokenCexBalance = Number(srcTokenCexBalanceInfo.free);
    if (!_.isFinite(srcTokenCexBalance)) {
      logger.warn(`Cex has no balance`, tokenInfo[0].symbol);
      return 0;
    }
    const {
      asks: [[price]],
    } = quotationPrice.getCoinUsdtOrderbook(
        ammContext.baseInfo.srcToken.address,
        ammContext.baseInfo.srcToken.chainId
    );
    const priceBn = new BigNumber(price); // ETH/USDT 价格
    const dstTokenDexBalanceToSrcTokenCount = new BigNumber(dstTokenBalance)
        .div(priceBn)
        .toFixed(8)
        .toString(); // 目标币的Dex 余额，能换多少个SrcToken

    const dstTokenDexBalanceToSrcTokenCountNumber = Number(
        dstTokenDexBalanceToSrcTokenCount
    );
    logger.debug(srcTokenCexBalance, dstTokenDexBalanceToSrcTokenCountNumber);
    const minCount: any = _.min([
      srcTokenCexBalance,
      dstTokenDexBalanceToSrcTokenCountNumber,
    ]);
    return minCount;
  }

  public async calculateCapacity_11(ammContext: AmmContext): Promise<number> {
    const dstTokenBalance = chainBalance.getBalance(
        ammContext.baseInfo.dstToken.chainId,
        ammContext.walletInfo.walletName,
        ammContext.baseInfo.dstToken.address
    );
    if (_.isFinite(Number(dstTokenBalance))) {
      return dstTokenBalance;
    }
    logger.error(
        `The balance of the target currency on the dex cannot be obtained, and the quotation fails`
    );
    return 0;
  }

  private async calculateCapacity_bb(ammContext: AmmContext): Promise<number> {
    const tokenInfo = dataConfig.getCexStdSymbolInfoByToken(
        ammContext.baseInfo.srcToken.address,
        ammContext.baseInfo.dstToken.address,
        ammContext.baseInfo.srcToken.chainId,
        ammContext.baseInfo.dstToken.chainId
    );

    const dstTokenBalance = chainBalance.getBalance(
        ammContext.baseInfo.dstToken.chainId,
        ammContext.walletInfo.walletName,
        ammContext.baseInfo.dstToken.address
    );
    const srcTokenCexBalance = accountManager
        .getAccount(dataConfig.getHedgeConfig().hedgeAccount)
        ?.balance.getSpotBalance(tokenInfo[0].symbol);
    const usdtCexBalance = accountManager
        .getAccount(dataConfig.getHedgeConfig().hedgeAccount)
        ?.balance.getSpotBalance("USDT");
    if (!usdtCexBalance) {
      throw new Error("can't get cex cex USDT balance");
    }
    const {
      asks: [[srcTokenPrice]],
    } = quotationPrice.getCoinUsdtOrderbook(
        ammContext.baseInfo.srcToken.address,
        ammContext.baseInfo.srcToken.chainId
    );
    if (!_.isFinite(Number(srcTokenPrice))) {
      logger.error(`no valid orderbook price`);
      throw new Error("no valid orderbook price");
    }

    const dstMaxBuyCountBn = new BigNumber(usdtCexBalance.free).div(
        new BigNumber(srcTokenPrice)
    );

    const dstMaxBuyCount = Number(dstMaxBuyCountBn.toFixed(8).toString());
    const srcBalanceCount = Number(srcTokenCexBalance?.free);
    const max = _.min([srcBalanceCount, dstMaxBuyCount, dstTokenBalance]);
    return max;
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
    const hedgeInfo: ISpotHedgeInfo = JSON.parse(JSON.stringify(hedgeData));
    console.log("Basic Information on Current Hedging");
    console.log("========================");
    logger.debug(hedgeInfo);
    console.log("========================");
    this.writeJob(hedgeInfo);
  }

  private getStdSymbol(coinInfo: ICexCoinConfig[]) {
    if (
        coinInfo[0].coinType === ICoinType.Coin &&
        coinInfo[1].coinType === ICoinType.StableCoin
    ) {
      return `${coinInfo[0].symbol}/USDT`;
    }
    if (
        coinInfo[0].coinType === ICoinType.StableCoin &&
        coinInfo[1].coinType === ICoinType.Coin
    ) {
      return `${coinInfo[1].symbol}/USDT`;
    }
    throw "The correct symbol information was not found";
  }

  /**
   * Description Spot trading direction
   * @date 2023/3/3 - 21:36:15
   *
   * @private
   * @param {AmmContext} ammContext ""
   * @returns {("SELL" | "BUY")} "buy or sell"
   */
  private getSide(ammContext: AmmContext) {
    if (
        ammContext.baseInfo.srcToken.coinType === ICoinType.Coin &&
        ammContext.baseInfo.dstToken.coinType === ICoinType.StableCoin
    ) {
      return "SELL";
    }
    if (
        ammContext.baseInfo.srcToken.coinType === ICoinType.StableCoin &&
        ammContext.baseInfo.dstToken.coinType === ICoinType.Coin
    ) {
      return "BUY";
    }
    if (
        ammContext.baseInfo.srcToken.coinType === ICoinType.Coin &&
        ammContext.baseInfo.dstToken.coinType === ICoinType.Coin
    ) {
      if (
          ammContext.baseInfo.srcToken.symbol !==
          ammContext.baseInfo.dstToken.symbol
      ) {
        throw new Error(
            `Temporarily does not support the swap between different currency pairs`
        );
      }
    }
    logger.error(
        `Did not find the direction of buying and selling`,
        JSON.stringify(ammContext.baseInfo)
    );
    throw new Error(
        `Did not find the direction of buying and selling info:${ammContext.baseInfo.srcToken.symbol}/${ammContext.baseInfo.dstToken.symbol}`
    );
  }

  public async writeJob(hedgeInfo: ISpotHedgeInfo) {
    logger.info(`Write information to Job.....`);
    hedgeQueue.add(hedgeInfo);
  }
}

const coinSpotHedge: CoinSpotHedge = new CoinSpotHedge();
export {coinSpotHedge, CoinSpotHedge};
