import { IBridgeTokenConfigItem } from "./interface";

interface AmmContext {
  summary: string;
  bridgeItem: IBridgeTokenConfigItem;
  step: number; // 当前处于第几步
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
    inputAmount: string; //  前端输入的量
    inputAmountNumber: number;
    systemSrcFee: number; // Lock 之后开始有值
    systemDstFee: number; // Lock 之后开始有值
    lpReceiveAmount: number; // Lp 实际收到的量
    srcAmount: string; // 实际收到的量
    srcAmountNumber: number;
    dstAmount: string; // 实际转出的量
    dstAmountNumber: number;
  };
  chainOptInfo: {
    srcChainReceiveAmount: string; // A 链实际 tr in 的量
    srcChainReceiveAmountNumber: number; // A 链实际 tr in 的量
    dstChainPayAmount: string; // B 链实际付款金额
    dstChainPayAmountNumber: number; // B链实际付款的number
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
    native_token_orig_price: string; // 未扣除fee的原价
    price: string; // 1 的报价
    native_token_usdt_price: string;
    src_usd_price: string; // 左侧币对的U价
    capacity_num: number; // 左侧换币的最大数量
  };
  lockInfo: {
    fee: string;
    dstTokenPrice: string; // 目标币的U价格
    price: string; // 原始报价 换币价格
    srcTokenPrice: string; // 起始链 token usdt价格
    nativeTokenPrice: string; // 原生币的买价，lock时需要产生
    time: number;
  };
  askTime: number;
  systemOrder: {
    orderId: number;
    balanceLockedId: string; // 锁的mongoid
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
}

export { AmmContext };
