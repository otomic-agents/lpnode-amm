import { AmmContext } from "./context";

interface IBridgeTokenConfigItem {
  bridge_name: string; // tokenBridge的name
  src_chain_id: number;
  dst_chain_id: number;
  srcToken: string;
  dstToken: string;
  msmq_name: string;
  wallet: {
    name: string; // 目标链使用的钱包地址
    balance: { [key: string]: number }; // 目标链钱包的余额
  };
  dst_chain_client_uri: string; // 目标链客户端的链接地址
}

enum ICoinType {
  Coin = "coin",
  StableCoin = "stable_coin",
}

interface IHedgeConfig {
  hedgeType: IHedgeType;
  hedgeAccount: string;
}

interface ILPConfig {
  lp_id_fake: string; // lp 的id
}

interface ILPConfigCacheItem {
  bridge: {
    src_chain_id: number;
    dst_chain_id: number;
    src_token: string; // '0x7E477f81Fb9E7184190Ca53C8B9069532408Cc9B',
    dst_token: string; // '0x61D35C6B6a7568542acA42448B47690650C69bb9',
    bridge_name: string; // '9006_9006_0x7E477f81Fb9E7184190Ca53C8B9069532408Cc9B_0x61D35C6B6a7568542acA42448B47690650C69bb9'
  };
  wallet: {
    name: string; // 'lp-wallet-1',
    balance: any;
  };
  lp_receiver_address: string; // '0x0648e55e37FbADa5ADD959243939d7A7b469d72a',
  msmq_name: string; // 'bridge-A-B',
  src_client_uri: "";
  dst_client_uri: string; // 'http://obridge-chain-client-evm-bsc-server-9006:9100/evm-client-9006',
  relay_api_key: string; // '96OZBSog7PeRHBn'
}

interface ILPConfigCache {
  bridges: ILPConfigCacheItem[];
}

enum ILpCmd {
  "EVENT_ASK_REPLY" = "EVENT_ASK_REPLY", // 询价的回答
  "CMD_UPDATE_QUOTE" = "CMD_UPDATE_QUOTE", // 报价Cmd
  "CALLBACK_LOCK_QUOTE" = "CALLBACK_LOCK_QUOTE", // 允许锁定报价Cmd
  "CMD_TRANSFER_IN" = "CMD_TRANSFER_IN", // B链 转入 合约Cmd
  "CMD_TRANSFER_IN_CONFIRM" = "CMD_TRANSFER_IN_CONFIRM", // B链发钱给用户Cmd
  "CMD_TRANSFER_IN_REFUND" = "CMD_TRANSFER_IN_REFUND", // B链取消Tx In Cmd
}

interface ICexCoinConfig {
  chainId: number;
  address: string;
  coinType: string;
  addressLower: string;
  symbol: string;
  precision: number; // 币在Dex上的精度
}

interface IMarketOrderbookRet {
  code: number;
  data: { [key: string]: IOrderbookStoreItem };
}

enum IHedgeType {
  Null = "Null", // 不进行对冲
  CoinSpotHedge = "CoinSpotHedge", // 币本金 现货对冲
}

interface IHedgeClass {
  checkHedgeCond(ammContext: AmmContext);

  hedge(info: ISpotHedgeInfo);

  lockHedgeBalance(ammContext: AmmContext, accountId: string);

  writeJob(hedgeinfo: ISpotHedgeInfo);

  calculateCapacity(ammContext: AmmContext);

  getMinUsdAmount(): Promise<number>;
}

interface IOrderbookStoreItem {
  stdSymbol: string;
  symbol: string;
  lastUpdateId: number;
  timestamp: number;
  incomingTimestamp: number;
  stream: string;
  bids: string[][];
  asks: string[][];
}

interface ISpotHedgeInfo {
  orderId: number; // Lp_orderId
  ammContext: AmmContext;
}

interface IBalanceLock {
  locked: string;
  lockedTime: number;
  lockedId: string;
}

export {
  ISpotHedgeInfo,
  IBridgeTokenConfigItem,
  ILpCmd,
  IOrderbookStoreItem,
  IMarketOrderbookRet,
  ILPConfig,
  ILPConfigCache,
  IHedgeType,
  IHedgeClass,
  IHedgeConfig,
  ICexCoinConfig,
  ICoinType,
  IBalanceLock,
};