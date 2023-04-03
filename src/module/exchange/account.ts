import { ICexAccount, ICexExchangeList } from "../../interface/std_difi";
import { IStdExchange } from "../../interface/std_exchange";
import { StdBalance } from "./std_balance";
import { BinanceExchange } from "./cex_exchange/binance";
import { StdOrder } from "./std_order";
import { logger } from "../../sys_lib/logger";
import { StdInfo } from "./std_info";
/**
 * 用于描述 Account 账号，
 * Exchange 可以拥有多个Account ，每个Account 组合两个角色 Balance Order
 */
class StdAccount {
  private cexExchange: IStdExchange;
  private accountInfo: ICexAccount;
  public balance: StdBalance;
  public order: StdOrder;
  public info: StdInfo;

  constructor(option: ICexAccount) {
    this.accountInfo = option;
  }

  /**
   * Description 初始化账号列表
   * @date 2023-01-17 20:51:30
   * @public
   * @async
   * @return {Promise<void>} 空
   */
  public async init(): Promise<void> {
    if (this.accountInfo.exchangeName === ICexExchangeList.binance) {
      this.cexExchange = new BinanceExchange({
        spotAccount: {
          apiKey: this.accountInfo.spotAccount.apiKey,
          apiSecret: this.accountInfo.spotAccount.apiSecret,
        },
        usdtFutureAccount: {
          apiKey: this.accountInfo.usdtFutureAccount.apiKey,
          apiSecret: this.accountInfo.usdtFutureAccount.apiSecret,
        },
        coinFutureAccount: {
          apiKey: this.accountInfo.coinFutureAccount.apiKey,
          apiSecret: this.accountInfo.coinFutureAccount.apiSecret,
        },
      });
      logger.debug(
        `load exchange spot markets symbols 【${this.accountInfo.accountId}】`
      );
      try {
        await this.cexExchange.exchangeSpot.initMarkets(); // 现货市场初始化交易对
        await this.cexExchange.exchangeUsdtFuture.initMarkets(); // U本位合约初始化交易对
        await this.cexExchange.exchangeCoinFuture.initMarkets(); // 币本位合约初始化交易对
        await this.initBalance(this.cexExchange);
        await this.initOrder(this.cexExchange);
        await this.initInfo(this.cexExchange);
      } catch (e) {
        const err: any = e;
        logger.error(`初始化对冲账号发生了错误....`, err.toString());
        throw new Error(`初始化账号发生了错误，Err:${err.toString()}`);
      }

      return;
    }
    throw new Error(
      `账号初始化失败,没有初始化到对应的交易所,Data:${JSON.stringify(
        this.accountInfo
      )}`
    );
  }
  private async initOrder(cexExchange: IStdExchange) {
    this.order = new StdOrder(cexExchange);
  }
  private async initInfo(cexExchange: IStdExchange) {
    this.info = new StdInfo(cexExchange);
  }

  /**
   * Description 初始化balance类，并定时同步余额
   * @date 1/17/2023 - 8:53:26 PM
   *
   * @private
   * @async
   * @param {IStdExchange} cexExchange "标准交易所"
   * @returns {Promise<void>} ""
   */
  private async initBalance(cexExchange: IStdExchange): Promise<void> {
    this.balance = new StdBalance(cexExchange, this.accountInfo);
    await this.balance.syncSpotBalance();
    await this.balance.syncUsdtFutureBalance();
    await this.balance.syncCoinFutureBalance();
  }
  public getSpotStatus() {
    // this.cexExchange.getSpotStatus();
  }
}
export { StdAccount };
