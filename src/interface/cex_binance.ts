/**
 * 币安接口 interface的定义
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

// [
//   // 订单类型
//   "LIMIT", // 限价单
//   "MARKET", // 市价单
//   "STOP", // 止损单
//   "STOP_MARKET", // 止损市价单
//   "TAKE_PROFIT", // 止盈单
//   "TAKE_PROFIT_MARKET", // 止盈暑市价单
//   "TRAILING_STOP_MARKET", // 跟踪止损市价单
// ];
// "timeInForce": [ // 有效方式
// "GTC", // 成交为止, 一直有效
// "IOC", // 无法立即成交(吃单)的部分就撤销
// "FOK", // 无法全部立即成交就撤销
// "GTX" // 无法成为挂单方就撤销
// ]
// U本位Symbol info
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

// 币本位Symbol info
interface ICoinFutureSymbolItemBinance {
  stdSymbol: string;
  liquidationFee: string; // "0.010000"; // 强平费率
  marketTakeBound: string; // "0.30"; // 市价吃单(相对于标记价格)允许可造成的最大价格偏离比例
  symbol: string; // "BTCUSD_200925"; // 交易对
  pair: string; // "BTCUSD"; // 标的交易对
  contractType: string; // "CURRENT_QUARTER"; // 合约类型
  deliveryDate: number; // 1601020800000;
  onboardDate: number; // 1590739200000;
  contractStatus: string; // "TRADING"; // 交易对状态
  contractSize: number; // 100; //
  quoteAsset: string; // "USD"; // 报价币种
  baseAsset: string; // "BTC"; // 标的物
  marginAsset: string; // "BTC"; // 保证金币种
  pricePrecision: number; // 1; // 价格小数点位数(仅作为系统精度使用，注意同tickSize 区分)
  quantityPrecision: number; // 0; // 数量小数点位数(仅作为系统精度使用，注意同stepSize 区分)
  baseAssetPrecision: number; // 8;
  quotePrecision: number; // 8;
  equalQtyPrecision: number; // 4; // 请忽略
  triggerProtect: string; // "0.0500"; // 开启"priceProtect"的条件订单的触发阈值
  maintMarginPercent: string; // "2.5000"; // 请忽略
  requiredMarginPercent: string; // "5.0000"; // 请忽略
  underlyingType: string; // "COIN"; // 标的类型
  underlyingSubType: any; // []; // 标的物子类型
  orderTypes: string[];
}

// 订单相关定义
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
  "GTC" = "GTC", // 成交为止   订单会一直有效，直到被成交或者取消。
  "IOC" = "IOC", // 无法立即成交的部分就撤销 订单在失效前会尽量多的成交。
  "FOK" = "FOK", //	无法全部立即成交就撤销 如果无法全部成交，订单会失效。
}

// 现货余额的定义
interface ISpotBalanceItemBinance {
  asset: string;
  free: string;
  locked: string;
}

// U本位余额的定义
interface IUsdtFutureBalanceItemBinance {
  accountAlias: string; // "SgsR"; // 账户唯一识别码
  asset: string; // "USDT"; // 资产
  balance: string; // "122607.35137903"; // 总余额
  crossWalletBalance: string; // "23.72469206"; // 全仓余额
  crossUnPnl: string; // "0.00000000"; // 全仓持仓未实现盈亏
  availableBalance: string; // "23.72469206"; // 下单可用余额
  maxWithdrawAmount: string; // "23.72469206"; // 最大可转出余额
  marginAvailable: boolean; // true; // 是否可用作联合保证金
  updateTime: number; // 1617939110373;
  total: string; // 全仓余额
  free: string; // 全仓可用余额
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
  accountAlias: string; // "SgsR"; // 账户唯一识别码
  asset: string; // "BTC"; // 资产
  balance: string; // "0.00250000"; // 账户余额
  withdrawAvailable: string; // "0.00250000"; // 最大可提款金额,同`GET /dapi/account`中"maxWithdrawAmount"
  crossWalletBalance: string; // "0.00241969"; // 全仓账户余额
  crossUnPnl: string; // "0.00000000"; // 全仓持仓未实现盈亏
  availableBalance: string; // "0.00241969"; // 可用下单余额
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
