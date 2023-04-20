enum ICexExchangeList {
  "binance" = "binance",
}
// 余额相关定义________________________________________________________________________________
// 现货余额的定义
interface ISpotBalanceItem {
  asset: string;
  free: string;
  locked: string;
}
// U本位余额的定义
interface IUsdtFutureBalanceItem {
  accountAlias: string; // "FzmYFzsRfWTisR";
  asset: string; // "BTC";
  balance: string; // "0.04377417";
  crossWalletBalance: string; // "0.04377417";
  availableBalance: string; // "0.56178156";
  maxWithdrawAmount: string; // "0.04377417";
  marginAvailable: boolean; // true;
}
// 币本位余额的定义
interface ICoinFutureBalanceItem {
  accountAlias: string; // "SgsR"; // 账户唯一识别码
  asset: string; // "BTC"; // 资产
  balance: string; // "0.00250000"; // 账户余额
  withdrawAvailable: string; // "0.00250000"; // 最大可提款金额,同`GET /dapi/account`中"maxWithdrawAmount"
  crossWalletBalance: string; // "0.00241969"; // 全仓账户余额
  crossUnPnl: string; // "0.00000000"; // 全仓持仓未实现盈亏
  availableBalance: string; // "0.00241969"; // 可用下单余额
}
// ________________________________________________________________________________

// 现货 symbol info 的定义
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

// u本位永续 symbol info 的定义
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

// 币本位永续 symbol info 的定义
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

// 订单相关定义______________________________________
enum ISide {
  BUY = "BUY",
  SELL = "SELL",
}

interface ISpotOrderResult {
  orderId: number;
  side: string;
  lostAmount: string; // lostsize filter 之后损失的精度
  origAmount: string; // 计划输入的amount
  fee: { [key: string]: string };
  symbol: string; // "ETHUSDT"
  stdSymbol: string; // "ETH/USDT";
  type: string; // 'market', 'limit'
  amount: number; // 原始订单量
  filled: number; // 成交量
  remaining: number; // 0.4; // remaining amount to fill
  clientOrderId: string; // 'abcdef-ghijklmnop-qrstuvwxyz', // a user-defined clientOrderId, if any
  timestamp: number; // 下单时间
  averagePrice: string; // 成交均价
  lastTradeTimestamp: number;
  average: number; // float average filling price
  status: string; // 成交状态 // 'open', 'closed', 'canceled', 'expired', 'rejected'
  timeInForce: string; // "GTC"; // 'GTC', 'IOC', 'FOK', 'PO'
  info: string; // 原始的订单信息
}
// 账号相关定义______________________________________
interface ICexAccount {
  accountId: string;
  exchangeName: string; // binance huobi dex_bsc
  spotAccount: {
    apiKey: string;
    apiSecret: string;
  };
  usdtFutureAccount: {
    apiKey: string;
    apiSecret: string;
  };
  coinFutureAccount: {
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
};
