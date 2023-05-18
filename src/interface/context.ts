import { EFlowStatus, IBridgeTokenConfigItem } from "./interface";

interface AmmContext {
  appName: string;
  summary: string;
  bridgeItem: IBridgeTokenConfigItem;
  hedgeEnabled: boolean;
  step: number;
  systemInfo: {
    msmqName: string;
  };
  walletInfo: {
    walletName: string;
  };
  AskInfo: {
    cid: string;
  };
  baseInfo: {
    fee: number;
    srcChain: {
      id: number;
      tokenName: string;
    };
    dstChain: {
      id: number;
      tokenName: string;
    };
    srcToken: {
      precision: number;
      cexPrecision: number;
      address: string;
      coinType: string;
      symbol: string;
      chainId: number;
    };
    dstToken: {
      precision: number;
      cexPrecision: number;
      address: string;
      coinType: string;
      symbol: string;
      chainId: number;
    };
  };
  swapInfo: {
    inputAmount: string;
    inputAmountNumber: number;
    systemSrcFee: number;
    systemDstFee: number;
    lpReceiveAmount: number;
    srcAmount: string;
    srcAmountNumber: number;
    dstAmount: string;
    dstAmountNumber: number;
  };
  chainOptInfo: {
    srcChainReceiveAmount: string;
    srcChainReceiveAmountNumber: number;
    dstChainPayAmount: string;
    dstChainPayAmountNumber: number;
    dstChainPayNativeTokenAmount: string;
    dstChainPayNativeTokenAmountNumber: number;
  };
  quoteInfo: {
    usd_price: string;
    quote_hash: string;
    mode: string;
    origPrice: string;
    origTotalPrice: string;
    native_token_price: string;
    native_token_orig_price: string;
    price: string;
    native_token_usdt_price: string;
    src_usd_price: string;
    capacity_num: number;
  };
  lockInfo: {
    fee: string;
    dstTokenPrice: string;
    price: string;
    srcTokenPrice: string;
    nativeTokenPrice: string;
    time: number;
  };
  askTime: number;
  systemOrder: {
    orderId: number;
    balanceLockedId: string;
    bridgeConfig: any;
    hedgePlan: any[];
    hedgeResult: any[];
  };
  tradeStatus: number;
  profitStatus: number;
  systemContext: {
    lockStepInfo: any;
    transferoutConfirmInfo: any;
  };
  flowStatus: EFlowStatus;
  transferoutConfirmTime: number;
}

export { AmmContext };
