import {} from "./cex_binance";
import {
  ISpotOrderResult,
  ISpotSymbolItem,
  ISpotBalanceItem,
  ISide,
  IUsdtFutureSymbolItem,
  IUsdtFutureBalanceItem,
  ICoinFutureBalanceItem,
  ICoinFutureSymbolItem,
  IUsdtFutureAccountPositionsRiskItem,
  IOrderExecModel,
} from "./std_difi";
import BigNumber from "bignumber.js";
interface IStdExchangeSpot {
  exchangeName: string;
  loadMarkets(): Promise<void>;
  fetchMarkets(): Map<string, ISpotSymbolItem>;
  loadBalance(): Promise<any>;
  withdrawApply?(): Promise<any>;
  capitalAll?(): Promise<any>;
  getOrderExecModel(): IOrderExecModel;
  formatOrder?(input: any): ISpotOrderResult;
  spotTradeCheck(
    stdSymbol: string,
    value: number,
    amount: number
  ): Promise<boolean>;
  getTradeMinMax(stdSymbol: string, price: number): Promise<[number, number]>;

  getTradeMinMaxValue(stdSymbol: string): Promise<[number, number]>;

  getTradeMinNotional(stdSymbol: string): Promise<number>;

  createMarketOrder(
    orderId: string,
    stdSymbol: string,
    amount: BigNumber | undefined,
    quoteOrderQty: BigNumber | undefined,
    side: ISide,
    targetPrice: BigNumber | undefined,
    simulation: boolean
  ): Promise<ISpotOrderResult | boolean>;
  // A result result is returned when placing an order synchronously
  // When placing an order asynchronously, it only displays whether the submission is successful
  getBalance(): Map<string, ISpotBalanceItem>;
}

interface IStdExchangeUsdtFuture {
  loadMarkets(): Promise<void>;

  fetchOrdersBySymbol(symbol: string): Promise<any>;

  fetchMarkets(): Map<string, IUsdtFutureSymbolItem>;

  loadBalance(): Promise<any>;

  fetchPositionRisk(): Promise<any>;
  getPositionRisk(): Map<string, IUsdtFutureAccountPositionsRiskItem>;
  createMarketOrder(
    orderId: string,
    stdSymbol: string,
    amount: BigNumber,
    side: ISide
  ): Promise<ISpotOrderResult>; // market order
  getBalance(): Map<string, IUsdtFutureBalanceItem>;
}

interface IStdExchangeCoinFuture {
  loadMarkets(): Promise<void>;

  fetchMarkets(): Map<string, ICoinFutureSymbolItem>;

  fetchBalance(): Promise<any>;

  getBalance(): Map<string, ICoinFutureBalanceItem>;
}

interface IStdExchange {
  exchangeName: string;
  exchangeSpot: IStdExchangeSpot;
  exchangeUsdtFuture: IStdExchangeUsdtFuture;
  exchangeCoinFuture: IStdExchangeCoinFuture;
}

export {
  IStdExchange,
  IStdExchangeSpot,
  IStdExchangeUsdtFuture,
  IStdExchangeCoinFuture,
};
