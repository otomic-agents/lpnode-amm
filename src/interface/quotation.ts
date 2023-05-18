interface IQuoteData {
  __initSrcSellPrice?: string;
  __initSrcBuyPrice?: string;
  __initDstBuyPrice?: string;
  __initDstSellPrice?: string;
  __initDstGasBuyPrice?: string;
  __initDstGasSellPrice?: string;
  usd_price: string;
  price: string;
  origPrice: string;
  origTotalPrice: string;
  min_amount: string;
  gas: string;
  capacity: string;
  native_token_price: string;
  native_token_usdt_price: string;
  native_token_max: string;
  native_token_min: string;
  timestamp: number;
  quote_hash: string;
}

export { IQuoteData };
