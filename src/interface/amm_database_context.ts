import { EFlowStatus, IBridgeTokenConfigItem } from "./interface";
import { ObjectId } from 'mongodb';
interface AmmDatabaseContext {
  _id: ObjectId,
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
    lpId: string;
  };
  baseInfo: {
    fee: number;
    sourceFee?: number;
    srcChain: {
      id: number;
      nativeTokenPrecision: number;
      nativeTokenName: string;
      tokenName: string;
    };
    dstChain: {
      id: number;
      nativeTokenPrecision: number;
      nativeTokenName: string;
      tokenName: string;
    };
    srcToken: {
      precision: number;
      cexPrecision: number;
      address: string;
      coinType: string;
      symbol: string;
      chainId: number;
      tokenName: string;
    };
    dstToken: {
      precision: number;
      cexPrecision: number;
      address: string;
      coinType: string;
      symbol: string;
      chainId: number;
      tokenName: string;
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
    dstAmount: string;  // need
    dstSourceAmount: string;
    dstAmountNumber: number;
    dstSourceNativeAmount: string;
    dstNativeAmount: string; // need
    dstNativeAmountNumber: number;
    stepTimeLock: number;
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
    dst_usd_price: string;
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
  tradeStatus: string;
  profitStatus: number;
  systemContext: {
    lockStepInfo: any;
    transferoutInfo?: any;
    transferoutConfirmInfo: any;
  };
  flowStatus: EFlowStatus;
  transferoutConfirmTime: number;
  hasTransaction: boolean;
  dexTradeInfo_out?: any;
  dexTradeInfo_in?: any;
  dexTradeInfo_in_refund?: any;
  dexTradeInfo_in_confirm?: any;
  dexTradeInfo_init_swap?: any;
  dexTradeInfo_confirm_swap?: any;
  dexTradeInfo_refund_swap?: any;
  swapAssetInformation?: any;
}

export { AmmDatabaseContext };
