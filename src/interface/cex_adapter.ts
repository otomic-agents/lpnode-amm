interface ISpotSymbolItemAdapter {
  id: string; //"VIDTUSDT",
  lowercaseId: string; //  "vidtusdt",
  symbol: string; // "VIDT/USDT",
  base: string; //"VIDT",
  quote: string; // "USDT",
  settle: string | null; //null;
  baseId: string; // "VIDT";
  quoteId: string; // "USDT";
  settleId: string | null; // null;
  type: string; // "spot";
  spot: boolean; // true;
  margin: boolean; // false;
  swap: boolean; //false;
  future: boolean; //false;
  option: boolean; //false;
  active: boolean; //true;
  contract: boolean; //false;
  linear: null | boolean; //null;
  inverse: null | boolean; //null;
  taker: number; // 0.001;
  maker: number; // 0.001;
  contractSize: number | null; // null;
  expiry: number | null; // null;
  expiryDatetime: string | null; // null;
  strike: null;
  optionType: null;
  precision: { amount: number; price: number; base: number; quote: number }; // { amount: 0; price: 5; base: 8; quote: 8 };
  limits: {
    leverage: { min: number | null; max: number | null };
    amount: { min: number | null; max: number | null };
    price: { min: number | null; max: number | null };
    cost: { min: number | null; max: number | null };
    market: { min: number | null; max: number | null };
  };
}
export { ISpotSymbolItemAdapter };
