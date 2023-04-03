interface SystemRecord {
  balanceLockId: number;
  bridgeConfig: any;
  lockAmount: string;
  hash: string;
  timestamp: number; // 订单创建的时间
  transferOutTimestamp?: number;
  transferConfirmTimestamp?: number;
  hedgeTimestamp: number; // 订单对冲的时间
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
    amount: string; // 兑换的数量
    quoteHash: string; // 报价时的hash
    price: string; // 报价的价格
    capacity: string;
    nativeTokenPrice: string; // 原生币的价格
  };
  transferOutInfo?: {
    amount: string; // 转入的量
  };
  TransferInInfo: {
    amount: string; // B链存入的token数量
  };
  hedgeInfo?: {
    status: number;
    errorMessage: string;
    targetPrice: string; // 对冲的目标价
    orderInfo: any; // 对冲单
    gasInfo: {
      gasPrice: string;
      gas: string;
      gasUsedUsd: string; // gas  的U价
    };
  };
}
function CreateRecord(): any {
  const record: any = {};
  return record;
}

export { SystemRecord, CreateRecord };
