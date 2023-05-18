/**
 * binance interface define
 */
// 现货Symbol info
interface ISpotSymbolItemBinance {
  symbol: string;
  status: "TRADING";
  stdSymbol: string;
  baseAsset: string;
  quoteAsset: string;
  orderTypes: string[];
  baseAssetPrecision: number;
  quoteAssetPrecision: number;
  filters: any[];
}

// USDT Symbol info
interface IUsdtFutureSymbolItemBinance {
  stdSymbol: string;
  symbol: string; // "BLZUSDT"; // 交易对
  pair: string; // "BLZUSDT"; // 标的交易对
  contractType: string; // "PERPETUAL"; // 合约类型
  deliveryDate: string; // 4133404800000; // 交割日期
  onboardDate: string; // 1598252400000; // 上线日期
  status: string; // "TRADING"; // 交易对状态
  maintMarginPercent: string; // "2.5000"; // 请忽略
  requiredMarginPercent: string; // "5.0000"; // 请忽略
  baseAsset: string; // "BLZ"; // 标的资产
  quoteAsset: string; // "USDT"; // 报价资产
  marginAsset: string; // "USDT"; // 保证金资产
  pricePrecision: number; // 5; // 价格小数点位数(仅作为系统精度使用，注意同tickSize 区分）
  quantityPrecision: number; // 0; // 数量小数点位数(仅作为系统精度使用，注意同stepSize 区分）
  baseAssetPrecision: number; // 8; // 标的资产精度
  quotePrecision: number; // 8; // 报价资产精度
  underlyingType: string; // "COIN";
  underlyingSubType: string[]; // ["STORAGE"];
  settlePlan: number; // 0;
  triggerProtect: string; // "0.15"; // 开启"priceProtect"的条件订单的触发阈值
  orderTypes: string[];
  timeInForce: string[];
}

// Coin Symbol info
interface ICoinFutureSymbolItemBinance {
  stdSymbol: string;
  liquidationFee: string; // "0.010000";
  marketTakeBound: string; // "0.30";
  symbol: string; // "BTCUSD_200925";
  pair: string; // "BTCUSD";
  contractType: string; // "CURRENT_QUARTER";
  deliveryDate: number; // 1601020800000;
  onboardDate: number; // 1590739200000;
  contractStatus: string; // "TRADING";
  contractSize: number; // 100;
  quoteAsset: string; // "USD";
  baseAsset: string; // "BTC";
  marginAsset: string; // "BTC";
  pricePrecision: number; // 1;
  quantityPrecision: number; // 0;
  baseAssetPrecision: number; // 8;
  quotePrecision: number; // 8;
  equalQtyPrecision: number; // 4;
  triggerProtect: string; // "0.0500";
  maintMarginPercent: string; // "2.5000";
  requiredMarginPercent: string; // "5.0000";
  underlyingType: string; // "COIN";
  underlyingSubType: any; // [];
  orderTypes: string[];
}

// order define
interface ISpotOrderResponseBinance {
  symbol: string; // "ETHUSDT";
  orderId: number; // 4146034;
  orderListId: number; // -1;
  clientOrderId: string; // "S_01";
  transactTime: number; // 1673869365312;
  price: string; // "0.00000000";
  origQty: string; // "0.05000000";
  executedQty: string; // "0.05000000";
  cummulativeQuoteQty: string; // "77.28150000";
  status: string; // "FILLED";
  timeInForce: string; // "GTC";
  type: string; // "MARKET" ;
  side: string; // "SELL";
  workingTime: number; // 1673869365312;
  fills: [
    {
      price: string; // "1545.63000000";
      qty: string; // "0.05000000";
      commission: string; // "0.00000000";
      commissionAsset: string; // "USDT";
      tradeId: number; // 458664;
    }
  ];
  selfTradePreventionMode: "NONE";
}

enum IOrderTypeBinance {
  "Market" = "MARKET",
}

enum ITimeInForceBinance {
  "GTC" = "GTC",
  "IOC" = "IOC",
  "FOK" = "FOK",
}

// spot balance define
interface ISpotBalanceItemBinance {
  asset: string;
  free: string;
  locked: string;
}

// balance  usdt define
interface IUsdtFutureBalanceItemBinance {
  accountAlias: string; // "SgsR";
  asset: string; // "USDT";
  balance: string; // "122607.35137903";
  crossWalletBalance: string; // "23.72469206";
  crossUnPnl: string; // "0.00000000";
  availableBalance: string; // "23.72469206";
  maxWithdrawAmount: string; // "23.72469206";
  marginAvailable: boolean; // true;
  updateTime: number; // 1617939110373;
  total: string; //
  free: string; //
  timestamp: number;
}
interface IUsdtFutureAccountPositionsRiskItemBinance {
  symbol: string; // "SUSHIUSDT";
  positionAmt: string; // "0";
  entryPrice: string; // "0.0";
  markPrice: string; // "0.00000000";
  unRealizedProfit: string; // "0.00000000";
  liquidationPrice: string; // "0";
  leverage: string; // "1";
  maxNotionalValue: string; // "1.0E7";
  marginType: string; // "cross"
  isolatedMargin: string; // "0.00000000";
  isAutoAddMargin: string;
  positionSide: string; // "LONG";
  notional: string; // "0";
  isolatedWallet: string; // "0";
  updateTime: number; // 0;
}

// 币本位余额的定义
interface ICoinFutureBalanceItemBinance {
  accountAlias: string; // "SgsR";
  asset: string; // "BTC";
  balance: string; // "0.00250000";
  withdrawAvailable: string; // "0.00250000";
  crossWalletBalance: string; // "0.00241969";
  crossUnPnl: string; // "0.00000000";
  availableBalance: string; // "0.00241969";
  updateTime: number; // 1592468353979;
}

enum ISideBinance {
  "Buy" = "BUY",
  "Sell" = "SELL",
}

export {
  ISpotSymbolItemBinance,
  ISideBinance,
  IOrderTypeBinance,
  ITimeInForceBinance,
  ISpotOrderResponseBinance,
  ISpotBalanceItemBinance,
  IUsdtFutureBalanceItemBinance,
  IUsdtFutureSymbolItemBinance,
  ICoinFutureBalanceItemBinance,
  ICoinFutureSymbolItemBinance,
  IUsdtFutureAccountPositionsRiskItemBinance,
};
