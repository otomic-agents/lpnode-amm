interface ISpotBalanceItemPortfolio {
  asset: string;
  free: string;
  locked: string;
}

// balance  usdt define
interface IUsdtFutureBalanceItemPortfolio {
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

interface ISpotSymbolItemPortfolio {
  stdSymbol: string; // ETH/USDT
  base_coin: string; // "1INCH";
  contract_size: number; // 0;
  exchange: number; // 2;
  exchange_name: string; // "binance_spot";
  expiration_timestamp: number; // 0;
  market_name: string; // "1INCHBTC";
  market_type: string; // "spot";
  min_trade_amount: number; // 0.1;
  max_trade_amount: number;
  min_trade_quote: number; // 0;
  order_price_type: string; // "quote";
  order_size_type: string; // "base";
  price_decmil_len: number; // 8;
  price_tick: number; // 1e-8;
  put_call_type: string; // "";
  quote_coin: string; // "BTC";
  real_exchange_id: number; // 15;
  settle_coin: string; // "";
  size_decmil_len: number; // 1;
  size_multiplier: number; // 1.04472987e-316;
  size_tick: number; // 0.1;
  strike_price: number; // 0;
  underlying_contract: string; // "";
}

enum IOrderTypePortfolio {
  "Market" = "MARKET",
}

export {
  ISpotSymbolItemPortfolio,
  ISpotBalanceItemPortfolio,
  IUsdtFutureBalanceItemPortfolio,
  IOrderTypePortfolio,
};
