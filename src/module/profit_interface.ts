import { ISide } from "../interface/std_difi";

interface IProfitAssetsRecord {
  stdSymbol: string;
  side: string;
  clientOrderId: number;
  cexOrderId: string;
  assets: string;
  amount: number;
  des?: string;
  average: number;
  lostAmount: string;
  action: string;
}
interface IProfit {
  priceInfo: {
    coinPrice: string;
    coinOrigPrice: string;
    nativeCoinPrice: string;
    nativeCoinOrigPrice: string;
  };
  userInput: {
    amount: number;
    assets: string;
    tokenName: string;
  };
  srcChainInfo: {
    received: {
      // 起始链收入的资产
      amount: number;
      assets: string;
    }[];
    systemDeduct: {
      amount: number;
      assets: string;
      fee: string;
    }[];
  };
  dstChainInfo: {
    send: {
      amount: number;
      assets: string;
    }[];
    systemDeduct: {
      amount: number;
      assets: string;
      fee: string;
    }[];
  };
  cexInfo: {
    hedgePlan: {
      orderId: string;
      symbol: string;
      side: ISide;
      amount: string;
      amountNumber: number;
    }[];
    orders: {
      amount: number;
      symbol: string;
      slippage: string;
      fee: any;
    }[];
    assetsList: {
      assets: string;
      amount: number;
      des?: string;
      average: number;
    }[];
  };
  profit: {
    recode: {
      amount: number;
      assets: string;
      dst: string;
    }[];
  };
}
export { IProfitAssetsRecord, IProfit };
