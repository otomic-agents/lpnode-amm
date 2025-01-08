interface SystemRecord {
  balanceLockId: number;
  bridgeConfig: any;
  lockAmount: string;
  hash: string;
  timestamp: number; // create time
  transferOutTimestamp?: number;
  transferOutConfirmTimestamp?: number;
  transferInTimestamp?: number;
  transferInConfirmTimestamp?: number;
  transferInRefundTimestamp?: number;
  initSwapTimestamp?: number;
  confirmSwapTimestamp?: number;
  refundSwapTimestamp?: number;
  hedgeTimestamp: number; // hedge time
  id: string;
  baseInfo?: {
    srcChain: {
      id: number;
      name: string;
    };
    dstChain: {
      id: number;
      name: string;
    };
    srcToken: {
      address: string;
      symbol: string;
      coinType: string;
    };
    dstToken: {
      address: string;
      symbol: string;
      coinType: string;
    };
  };
  quoteInfo: {
    amount: string; // input amount
    quoteHash: string; // quote hash
    price: string;
    capacity: string;
    nativeTokenPrice: string;
  };
  transferOutInfo?: {
    amount: string; // tranfer out amount
  };
  TransferInInfo: {
    amount: string;
  };
  hedgeInfo?: {
    status: number;
    errorMessage: string;
    targetPrice: string;
    orderInfo: any;
    gasInfo: {
      gasPrice: string;
      gas: string;
      gasUsedUsd: string;
    };
  };
}
function CreateRecord(): any {
  const record: any = {};
  return record;
}

export { SystemRecord, CreateRecord };
