enum ICexExchangeList {
  "binance" = "binance",
}

interface ISpotBalanceItem {
  asset: string;
  free: string;
  locked: string;
}

interface IUsdtFutureBalanceItem {
  accountAlias: string; // "FzmYFzsRfWTisR";
  asset: string; // "BTC";
  balance: string; // "0.04377417";
  crossWalletBalance: string; // "0.04377417";
  availableBalance: string; // "0.56178156";
  maxWithdrawAmount: string; // "0.04377417";
  marginAvailable: boolean; // true;
}

interface ICoinFutureBalanceItem {
  accountAlias: string; // "SgsR";
  asset: string; // "BTC";
  balance: string; // "0.00250000";
  withdrawAvailable: string; // "0.00250000";
  crossWalletBalance: string; // "0.00241969";
  crossUnPnl: string; // "0.00000000";
  availableBalance: string; // "0.00241969";
}
// ________________________________________________________________________________

// Spot symbol info define
interface ISpotSymbolItem {
  symbol: string;
  status: string; // "TRADING";
  stdSymbol: string;
  baseAsset: string;
  quoteAsset: string;
  orderTypes: string[];
  baseAssetPrecision: number;
  quoteAssetPrecision: number;
}

// Future:USDT symbol info define
interface IUsdtFutureSymbolItem {
  symbol: string;
  status: string; // "TRADING";
  stdSymbol: string;
  symbolType: string;
  baseAsset: string;
  quoteAsset: string;
  orderTypes: string[];
  baseAssetPrecision: number;
  quoteAssetPrecision: number;
}

// Future:Coin symbol info define
interface ICoinFutureSymbolItem {
  symbol: string;
  status: string; // "TRADING";
  stdSymbol: string;
  symbolType: string;
  baseAsset: string;
  quoteAsset: string;
  orderTypes: string[];
  baseAssetPrecision: number;
  quoteAssetPrecision: number;
}

interface IUsdtFutureAccountPositionsRiskItem {
  symbol: string;
  fetchTimestamp: string;
  LONG?: {
    qty: string;
    availQty: string;
    avgCost: string;
    leverage: string;
    liquidationPrice: string;
    lastPrice: string;
    markPrice: string;
  };
  SHORT?: {
    qty: string;
    availQty: string;
    avgCost: string;
    leverage: string;
    liquidationPrice: string;
    lastPrice: string;
    markPrice: string;
  };
}

// order define______________________________________
enum ISide {
  BUY = "BUY",
  SELL = "SELL",
}

interface ISpotOrderResult {
  orderId: number;
  side: string;
  lostAmount: string;
  origAmount: string; // 的amount
  fee: { [key: string]: string };
  symbol: string; // "ETHUSDT"
  stdSymbol: string; // "ETH/USDT";
  type: string; // 'market', 'limit'
  amount: number; // original order quantity
  filled: number;
  remaining: number; // 0.4; // remaining amount to fill
  clientOrderId: string; // 'abcdef-ghijklmnop-qrstuvwxyz', // a user-defined clientOrderId, if any
  timestamp: number; // order time
  averagePrice: string;
  lastTradeTimestamp: number;
  average: number; // float average filling price
  status: string; //  'open', 'closed', 'canceled', 'expired', 'rejected'
  timeInForce: string; // "GTC"; // 'GTC', 'IOC', 'FOK', 'PO'
  info: string; // original order info
}
enum ICexAccountApiType {
  exchange = "exchange",
  portfolio = "profolio",
}
// account define______________________________________
interface ICexAccount {
  accountId: string;
  exchangeName: string; // binance huobi dex_bsc
  apiType: ICexAccountApiType;
  spotAccount?: {
    apiKey: string;
    apiSecret: string;
  };
  usdtFutureAccount?: {
    apiKey: string;
    apiSecret: string;
  };
  coinFutureAccount?: {
    apiKey: string;
    apiSecret: string;
  };
  des?: string;
}

export {
  ICexExchangeList,
  ISpotOrderResult,
  ICexAccount,
  ISpotBalanceItem,
  ISpotSymbolItem,
  ISide,
  IUsdtFutureSymbolItem,
  IUsdtFutureBalanceItem,
  ICoinFutureBalanceItem,
  ICoinFutureSymbolItem,
  IUsdtFutureAccountPositionsRiskItem,
  ICexAccountApiType,
};
