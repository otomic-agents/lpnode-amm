import { AmmContext } from "./context";
import BigNumber from "bignumber.js";
import { FeeManager } from "../module/bridge_extend/fee_manager";
import { StatusManager } from "../module/bridge_extend/status_manager";
import { LpWalletManager } from "../module/bridge_extend/lp_wallet_manager";
import { SymbolManager } from "../module/bridge_extend/symbol_manager";
import { BridgeHedgeInfo } from "../module/bridge_extend/bridge_hedge_info";

interface IBridgeTokenConfigItem {
  id: string;
  bridge_name: string; // tokenBridge的name
  src_chain_id: number;
  dst_chain_id: number;
  srcToken: string;
  dstToken: string;
  msmq_name: string;
  msmq_path :string;
  relay_api_key:string;
  std_symbol: string;
  wallet: {
    name: string;
    balance: { [key: string]: number };
  };
  dst_chain_client_uri: string;
  src_chain_client_url: string;
  enable_hedge: boolean;
  fee_manager: FeeManager;
  status_manager: StatusManager;
  lp_wallet_info: LpWalletManager;
  symbol_info: SymbolManager;
  hedge_info: BridgeHedgeInfo;
  fee: string;
}

enum ISwapStep {
  ASK = "ASK",
  LOCK = "LOCK",
}

enum ICoinType {
  Coin = "coin",
  StableCoin = "stable_coin",
}

interface IHedgeConfig {
  hedgeType: IHedgeType;
  hedgeAccount: string;
  feeSymbol: string;
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
  dst_client_uri: string; // 'http://chain-client-evm-bsc-server-9006:9100/evm-client-9006',
  relay_api_key: string; // '96OZBSog7PeRHBn'
}

interface ILPConfigCache {
  bridges: ILPConfigCacheItem[];
}

enum ILpCmd {
  "EVENT_ASK_REPLY" = "EVENT_ASK_REPLY",
  "CMD_UPDATE_QUOTE" = "CMD_UPDATE_QUOTE",
  "CALLBACK_LOCK_QUOTE" = "CALLBACK_LOCK_QUOTE",
  "CMD_TRANSFER_IN" = "CMD_TRANSFER_IN",
  "CMD_TRANSFER_IN_CONFIRM" = "CMD_TRANSFER_IN_CONFIRM",
  "CMD_TRANSFER_IN_REFUND" = "CMD_TRANSFER_IN_REFUND",
}

interface ICexCoinConfig {
  chainId: number;
  address: string;
  coinType: string;
  addressLower: string;
  symbol: string;
  precision: number;
  tokenName: string;
}

interface IMarketOrderbookRet {
  code: number;
  data: { [key: string]: IOrderbookStoreItem };
}

enum IHedgeType {
  Null = "Null",
  CoinSpotHedge = "CoinSpotHedge",
}

interface IHedgeClass {
  worker: {
    prepareOrder(ammContext: AmmContext): Promise<any>;
  };

  getHedgeFeeSymbol(): string;

  checkMinHedge(
    ammContext: AmmContext,
    unitPrice: number,
    dstUnitPrice: number
  ): Promise<boolean>;

  getMinHedgeAmount(
    ammContext: AmmContext,
    srcPrice: number,
    dstPrice: number,
    gasTokenPrice: number
  ): Promise<number>;

  checkSwapAmount(ammContext: AmmContext): Promise<boolean>;

  getHedgeAccountState(): Promise<number>;

  getSwapMax(ammContext: AmmContext): Promise<BigNumber>; // Returns the maximum amount that can be swapped

  checkHedgeCond(ammContext: AmmContext): any; // check Hedge Cond
  preExecOrder(ammContext: AmmContext): Promise<boolean>;

  hedge(info: ISpotHedgeInfo): any;

  lockHedgeBalance(ammContext: AmmContext, accountId: string): any;

  writeJob(hedgeinfo: ISpotHedgeInfo): any;

  calculateCapacity(ammContext: AmmContext): any;
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

enum EFlowStatus {
  Init = "Init",
  AnswerOffer = "AnswerOffer",
  Locked = "Locked",
  TransferOut = "TransferOut",
  TransferIn = "TransferIn",
  TransferInefund = "TransferInefund",
  WaitHedge = "WaitHedge",
  NoHedge = "NoHedge",
  HedgeCompletion = "HedgeCompletion",
  HedgeSubmitted = "HedgeSubmitted",
  HedgeFailure = "HedgeFailure",
  HedgeAnalyzeCompletion = "HedgeAnalyzeCompletion",
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
  ISwapStep,
  EFlowStatus,
};
