/* eslint-disable @typescript-eslint/indent */

import {
  IStdExchange,
  IStdExchangeCoinFuture,
  IStdExchangeSpot,
  IStdExchangeUsdtFuture,
} from "../../../interface/std_exchange";
import * as _ from "lodash";
import { BinanceSpot } from "./binance_spot";
import { BinanceUsdtFuture } from "./binance_usdt_future";
import { BinanceCoinFuture } from "./binance_coin_future";
class BinanceExchange implements IStdExchange {
  public exchangeSpot: IStdExchangeSpot;
  public exchangeUsdtFuture: IStdExchangeUsdtFuture;
  public exchangeCoinFuture: IStdExchangeCoinFuture;
  private spotAccount: {
    apiKey: string;
    apiSecret: string;
  } = { apiKey: "", apiSecret: "" };
  private usdtFutureAccount: {
    apiKey: string;
    apiSecret: string;
  } = { apiKey: "", apiSecret: "" };
  private coinFutureAccount: {
    apiKey: string;
    apiSecret: string;
  } = { apiKey: "", apiSecret: "" };
  public constructor(accountKeyInfo: {
    spotAccount: { apiKey: string; apiSecret: string };
    usdtFutureAccount: { apiKey: string; apiSecret: string };
    coinFutureAccount: { apiKey: string; apiSecret: string };
  }) {
    this.spotAccount = {
      apiKey: accountKeyInfo.spotAccount.apiKey,
      apiSecret: accountKeyInfo.spotAccount.apiSecret,
    };
    this.usdtFutureAccount = {
      apiKey: accountKeyInfo.usdtFutureAccount.apiKey,
      apiSecret: accountKeyInfo.usdtFutureAccount.apiSecret,
    };

    this.coinFutureAccount = {
      apiKey: accountKeyInfo.usdtFutureAccount.apiKey,
      apiSecret: accountKeyInfo.usdtFutureAccount.apiSecret,
    };
    this.exchangeSpot = new BinanceSpot(this.spotAccount);
    this.exchangeUsdtFuture = new BinanceUsdtFuture(this.usdtFutureAccount);
    this.exchangeCoinFuture = new BinanceCoinFuture(this.coinFutureAccount);
  }

  // /**
  //  * Description 这里还没有实现好
  //  * @date 2023/2/3 - 21:43:19
  //  *
  //  * @public
  //  * @async
  //  * @returns {void}
  //  */
  // public async initFutureMarkets() {
  //   // /fapi/1v / exchangeInfo;
  //   const url = `${this.futureApiBaseUrl}/fapi/v1/exchangeInfo`;
  //   const binanceRequest = new BinanceFutureRequest();
  //   try {
  //     const result = await binanceRequest.get(url);
  //     console.log(JSON.stringify(result));
  //   } catch (e) {
  //     logger.error(e);
  //     throw e;
  //   }
  // }
  // public fetchFutureMarkets() {
  //   //
  // }
}
export { BinanceExchange };
