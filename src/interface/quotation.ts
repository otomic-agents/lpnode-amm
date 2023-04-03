interface IQuoteData {
  __initSrcSellPrice?: string;
  __initSrcBuyPrice?: string;
  __initDstBuyPrice?: string;
  __initDstSellPrice?: string;
  __initDstGasBuyPrice?: string;
  __initDstGasSellPrice?: string;
  usd_price: string; // "", // 目标币的U价
  price: string; // "", // return this.calculate(item, price);
  origPrice: string; // "", // 币的原始报价，用于 之后计算滑点
  origTotalPrice: string;
  min_amount: string; // "", // 如果想要够gas 消耗，最低的兑换数量,目前的算法是  假设设置消耗20Usd Gas ，那么 如果收取千三的手续费能满足Gas的情况下，最少需要多少个Atoken
  gas: string; // `0`, // Gas 需要消耗多少个目标币，目前有Amount了，这里要重新算一下
  capacity: string; // `0x${(50000000000000000000000).toString(16)}`, // 根据对冲配置，计算出来的最大量
  native_token_price: string; // `0`, // 假设 ETH-USDT  BSC-AVAX  则价格为 ETH/AVAX
  native_token_usdt_price: string; // `0`, // 目标链原生币的买价，orderbook卖5价
  native_token_max: string; // `1`, // native_token_min * 10
  native_token_min: string; // `0.1`, // 根据链配置的Gas币 最少Usd 单位，计算出的最小token币的兑换个数
  timestamp: number; // new Date().getTime(),
  quote_hash: string; // "",
}

export { IQuoteData };
