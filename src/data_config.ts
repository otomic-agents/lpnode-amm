/* eslint-disable arrow-parens */
import { chainAdapter } from "./chain_adapter/chain_adapter";
import * as fs from "fs";
const bs58 = require("bs58");
import * as _ from "lodash";
import {
  IBridgeTokenConfigItem,
  ICexCoinConfig,
  IHedgeConfig,
  IHedgeType,
} from "./interface/interface";
import { logger } from "./sys_lib/logger";
import { chainListModule } from "./mongo_module/chain_list";
import axios from "axios";
import { appEnv } from "./app_env";
import { tokensModule } from "./mongo_module/tokens";
import { TimeSleepForever, TimeSleepMs } from "./utils/utils";
import { bridgesModule } from "./mongo_module/bridge";
import { dataRedis } from "./redis_bus";
import { installModule } from "./mongo_module/install";

import { ICexAccountApiType } from "./interface/std_difi";
import path from "path";

const Web3 = require("web3");
const web3 = new Web3();

class DataConfig {
  private baseConfig: any;
  private hedgeConfig: IHedgeConfig = {
    hedgeType: IHedgeType.Null,
    hedgeAccount: "",
  };
  private chainTokenUsd: Map<number, number> = new Map();
  // @ts-ignore
  private chainMaxTokenUsd: Map<number, number> = new Map();
  private chainMap: Map<number, string> = new Map();
  private chainDataMap: Map<number, { chainType: string }> = new Map();
  private chainTokenMap: Map<number, string> = new Map();
  private tokenToSymbolMap: Map<string, ICexCoinConfig> = new Map();
  private hedgeAccountList: {
    apiType: ICexAccountApiType;
    accountId: string;
    exchangeName: string;
    spotAccount?: {
      apiKey: string;
      apiSecret: string;
    };
    usdtFutureAccount?: {
      apiKey: string;
      apiSecret: string;
    };
    coinFutureAccount?: {
      apiKey: string;
      apiSecret: string;
    };
  }[] = [];
  private lpConfig: {
    quotationInterval: number;
  } = {
    quotationInterval: 1000 * 10,
  };
  private extendFun: any = null;
  private statusReport: any = null;
  public setExtend(extendFun: any) {
    this.extendFun = extendFun;
  }
  public setReport(report: any) {
    this.statusReport = report;
  }
  public getBaseConfig() {
    return this.baseConfig;
  }

  public getTokenList() {
    const tokenList: any[] = [];
    for (const [uniqKey, item] of this.tokenToSymbolMap) {
      _.set(item, "uniqKey", uniqKey);
      tokenList.push(item);
    }
    return tokenList;
  }

  public enableSwap: false;
  private bridgeTokenList: IBridgeTokenConfigItem[] = [];

  /**
   * Prepare admin Config
   * @date 2023/3/21 - 16:06:24
   *
   * @public
   * @async
   * @returns {*} "void"
   */
  public async prepareConfigResource() {
    let configId: string | null | undefined;
    let clientId: string;
    let configIdKey = "";
    try {
      const appName = _.get(process.env, "APP_NAME", null);
      if (!appName) {
        logger.error("Unable to get Appname");
        await TimeSleepMs(3000);
        process.exit(1);
      }
      configIdKey = `config_id_${appName}`;
      configId = await dataRedis.get(configIdKey);
      if (configId == null) {
        throw new Error("unable to get config from redis");
      }
      await this.getConfigResource(configId);
    } catch (e) {
      const err: any = e;
      logger.warn("ConfigId not found", err.toString());
      const errMessage = err.toString();
      if (
        errMessage.includes("configId is not exist") ||
        errMessage.includes("unable to get config from redis")
      ) {
        logger.error("configId is not exist,||||||||||");
        const [createConfigId, createClientId] =
          await this.createConfigResource();
        configId = createConfigId;
        clientId = createClientId;
        if (!clientId) {
          logger.error("unable to create resources remotely");
          process.exit(0);
        }
        await dataRedis.set(configIdKey, clientId).then(() => {
          console.log("save clientId to database", clientId);
        });
        await (() => {
          return new Promise(() => {
            this.statusReport
              .pendingStatus("Wait for the configuration to complete")
              .catch((e) => {
                logger.error(`Failed to write status`, e);
              });
            logger.warn("Wait for the configuration to complete..");
          });
        })();
      }
    }
    if (!configId) {
      logger.error("The correct configId was not read");
      process.exit(1);
    }
    logger.debug(`configId is:${configId} clientId`);
    const baseConfig: any = await this.getConfigResource(configId);
    await this.initBaseConfig(baseConfig);
  }

  public async rewriteMarketUrl() {
    const rewrite = _.get(process.env, "rewrite_market_host", "true");
    if (rewrite === "false") {
      logger.warn(`skip rewrite`);
      return;
    }
    const marketServiceRow = await installModule
      .findOne({
        installType: "market",
      })
      .lean();
    if (!marketServiceRow) {
      logger.error(
        `The correct market address cannot be found, and the default value cannot be overridden`
      );
      await this.statusReport.pendingStatus(
        "The correct market address cannot be found, and the default value cannot be overridden"
      );
      await TimeSleepForever(
        "The correct market address cannot be found, and the default value cannot be overridden"
      );
    } else {
      const rewriteHost = `amm-market-${marketServiceRow.name}-service`;
      logger.warn("rewrite market host ", rewriteHost);
      _.set(process, "_sys_config.lp_market_host", rewriteHost);
      // Port is default available, no rewrite needed.
    }
    await TimeSleepMs(5000);
  }

  private async initBaseConfig(baseConfig: any) {
    logger.info("baseConfig:", JSON.stringify(baseConfig));
    this.baseConfig = baseConfig;
    try {
      this.checkBaseConfig(baseConfig);
    } catch (e) {
      logger.debug(e);
      logger.error(`Incorrect base configuration data`);
      await TimeSleepForever(
        "The basic configuration data is incorrect, waiting for reconfiguration"
      );
    }
    const chainDataConfigList: {
      chainId: number;
      config: {
        minSwapNativeTokenValue: string;
        maxSwapNativeTokenValue: string;
      };
    }[] = _.get(baseConfig, "chainDataConfig", []);
    for (const chainData of chainDataConfigList) {
      this.chainTokenUsd.set(
        chainData.chainId,
        Number(chainData.config.minSwapNativeTokenValue)
      );
      this.chainMaxTokenUsd.set(
        chainData.chainId,
        Number(chainData.config.maxSwapNativeTokenValue)
      );
      logger.debug(
        chainData.chainId,
        "minSwapNativeTokenValue:",
        Number(chainData.config.minSwapNativeTokenValue),
        "maxSwapNativeTokenValue:",
        Number(chainData.config.maxSwapNativeTokenValue)
      );
    }
    let hedgeType = _.get(baseConfig, "hedgeConfig.hedgeType", null);
    const hedgeAccount = _.get(baseConfig, "hedgeConfig.hedgeAccount", null);
    if (!hedgeType) {
      logger.error(`Incorrect base configuration data`);
      await TimeSleepForever(
        "The basic configuration data is incorrect, waiting for reconfiguration"
      );
    }
    if (hedgeType === "null" || !hedgeType) {
      hedgeType = "Null";
    }
    this.hedgeConfig.hedgeType = hedgeType;
    this.hedgeConfig.hedgeAccount = hedgeAccount;
    this.hedgeAccountList = _.get(baseConfig, "hedgeConfig.accountList", []);
    if (hedgeAccount.length <= 0 && hedgeType !== "Null") {
      logger.error(
        `The basic configuration data is incorrect, please check the hedge account settings`
      );
      await TimeSleepForever(
        "The basic configuration data is incorrect, waiting for reconfiguration"
      );
    }
  }

  private checkBaseConfig(baseConfig: any) {
    const chainDataConfig: any[] = _.get(baseConfig, "chainDataConfig", []);
    if (!_.isArray(chainDataConfig)) {
      throw new Error(`chainDataConfig is incorrect `);
    }
    if (chainDataConfig.length <= 0) {
      throw new Error(` chainDataConfig is empty`);
    }
    for (const item of chainDataConfig) {
      if (
        !Object.keys(item["config"]).includes("minSwapNativeTokenValue") ||
        !Object.keys(item["config"]).includes("maxSwapNativeTokenValue")
      ) {
        throw new Error(`chainDataConfig is missing a field`);
      }
    }
  }

  public getHedgeAccountList() {
    return this.hedgeAccountList;
  }

  private async getConfigResource(configId: string) {
    let result;
    const lpAdminPanelUrl = appEnv.GetLpAdminUrl();
    const url = `${lpAdminPanelUrl}/lpnode/lpnode_admin_panel/configResource/get`;
    logger.info(`get configResource request :${url}`);

    try {
      result = await axios.request({
        url,
        method: "post",
        data: {
          clientId: configId,
        },
      });
      let template = _.get(result, "data.result.templateResult", "{}");
      if (template === "") {
        template = "{}";
      }
      console.log(template);
      const configData = JSON.parse(template);
      return configData;
    } catch (e: any) {
      const err: any = e;
      console.log("______________");
      console.log(e.toString());
      const serverErrorMessage = _.get(e, "response.data.message", "");
      if (serverErrorMessage.includes("configId is not exist")) {
        throw new Error("configId is not exist");
      } else {
        logger.error(`get config error:`, err.toString());
        throw e;
      }
    }
  }

  private async createConfigResource() {
    let result: any;
    const ammConfigPath = path.join(
      __dirname,
      "../../data_config",
      "amm_config.json"
    );
    console.log(ammConfigPath);
    let template =
      '{"chainDataConfig":[{"chainId":9006,"config":{"maxSwapNativeTokenValue":"50000","minSwapNativeTokenValue":"0.5"}}],"bridgeBaseConfig":{"defaultFee":"0.003","enabledHedge":false},"bridgeConfig":[],"orderBookType":"market","hedgeConfig":{"hedgeAccount":"001","hedgeType":"CoinSpotHedge","accountList":[{"enablePrivateStream":false,"apiType":"exchange_adapter","accountId":"001","exchangeName":"binance","spotAccount":{"apiKey":"","apiSecret":""},"usdtFutureAccount":{"apiKey":"","apiSecret":""},"coinFutureAccount":{"apiKey":"","apiSecret":""}}]}}';
    try {
      template = fs.readFileSync(ammConfigPath, { encoding: "utf-8" });
      logger.info("amm config load from config map", template);
    } catch (e) {
      logger.error(e);
      logger.warn("amm_config not found");
    }
    const lpAdminPanelUrl = appEnv.GetLpAdminUrl();
    try {
      result = await axios.request({
        url: `${lpAdminPanelUrl}/lpnode/lpnode_admin_panel/configResource/create`,
        method: "post",
        data: {
          appName: _.get(process.env, "APP_NAME", ""),
          version: _.get(process.env, "APP_VERSION", ""),
          clientId: Buffer.from(new Date().getTime().toString()).toString(
            "base64"
          ),
          template,
        },
      });
      logger.debug("create configuration return:", _.get(result, "data", ""));
      const id = _.get(result, "data.result.id", "");
      const clientId = _.get(result, "data.result.clientId", "");
      if (!id || id === "" || !clientId || clientId === "") {
        logger.error(
          "Failed to create configuration for service, unable to start, Lp_admin returns incorrect"
        );
        process.exit(5);
      }
      return [id, clientId];
    } catch (e) {
      const err: any = e;
      logger.error(
        "Error creating configuration",
        err.toString(),
        _.get(e, "response.data", "")
      );
    }
    return [];
  }

  public async loadBaseConfig() {
    setInterval(() => {
      this.loadTokenToSymbol().catch((e) => {
        logger.error("synchronize TokenList error");
      });
    }, 1000 * 60 * 2);
    await this.loadTokenToSymbol();
    await this.loadChainConfig();
  }

  private async loadTokenToSymbol() {
    const tokenList: {
      address: string;
      coinType: string;
      marketName: string;
      chainId: number;
      precision: number;
      tokenName: string;
    }[] = await tokensModule.find({}).lean();
    this.tokenToSymbolMap = new Map();
    tokenList.map((it) => {
      const uniqAddress = this.convertAddressToUniq(it.address, it.chainId);
      const key = `${it.chainId}_${uniqAddress}`;
      this.tokenToSymbolMap.set(key, {
        chainId: it.chainId,
        address: this.convertAddressToHex(it.address, it.chainId),
        addressLower: this.convertAddressToHex(
          it.address,
          it.chainId
        ).toLowerCase(),
        coinType: it.coinType,
        symbol: it.marketName,
        precision: it.precision,
        tokenName: it.tokenName,
      });
      return null;
    });
    console.log("Token List:");
    const view: {}[] = [];
    for (const [_, item] of this.tokenToSymbolMap) {
      const viewItem = {
        symbol: item.symbol,
        address: item.address,
        chainId: item.chainId,
        precision: item.precision,
      };
      view.push(viewItem);
    }
    console.table(view);

    await TimeSleepMs(100);
  }

  private async loadChainConfig() {
    const chainList: {
      chainId: number;
      chainName: string;
      chainType: string;
      tokenName: string;
      tokenUsd: number;
    }[] = await chainListModule.find({}).lean();

    _.map(chainList, (item) => {
      this.chainMap.set(item.chainId, item.chainName);
      this.chainDataMap.set(item.chainId, { chainType: item.chainType });
      this.chainTokenMap.set(item.chainId, item.tokenName);
    });
    console.log("chain base data:");
    console.table(chainList);
    await TimeSleepMs(100);
  }

  public getStdCoinSymbolInfoByToken(token: string, chainId: number) {
    const chainKey = `${chainId}`;
    const uniqAddress = this.convertAddressToUniq(token, chainId);
    const key = `${chainKey}_${uniqAddress}`;
    const info = this.tokenToSymbolMap.get(key);
    if (!info) {
      return { symbol: null, coinType: "" };
    }
    return info;
  }

  public getCexStdSymbolInfoByToken(
    token0: string,
    token1: string,
    token0ChainId: number,
    token1ChainId: number
  ): ICexCoinConfig[] | any {
    const uniqAddress0 = this.convertAddressToUniq(token0, token0ChainId);
    const uniqAddress1 = this.convertAddressToUniq(token1, token1ChainId);
    const key0 = `${token0ChainId}_${uniqAddress0}`;
    const key1 = `${token1ChainId}_${uniqAddress1}`;
    const token0Symbol = this.tokenToSymbolMap.get(key0);
    const token1Symbol = this.tokenToSymbolMap.get(key1);
    if (!token0Symbol || !token1Symbol) {
      logger.warn(`【${token0}/${token1}】not found`);
      return undefined;
    }
    return [token0Symbol, token1Symbol];
  }

  public getSymbolInfoByToken(token: string, chainId: number) {
    const uniqAddress = this.convertAddressToUniq(token, chainId);
    const key = `${chainId}_${uniqAddress}`;
    const tokenSymbol = this.tokenToSymbolMap.get(key);
    if (!tokenSymbol) {
      logger.warn("token was not found", chainId, token);
      return undefined;
    }
    return tokenSymbol;
  }

  public convertAddressToUniq(address: string, chainId: number): string {
    if (address.startsWith("0x")) {
      return web3.utils.hexToNumberString(address);
    }
    const chainType = _.get(
      this.chainDataMap.get(chainId),
      "chainType",
      undefined
    );
    if (chainType === "near") {
      const bytes = bs58.decode(address);
      const ud = web3.utils.hexToNumberString(
        `0x${Buffer.from(bytes).toString("hex")}`
      );
      return ud;
    }
    return address;
  }

  private convertAddressToHex(address: string, chainId: number): string {
    if (address.startsWith("0x")) {
      return address;
    }
    try {
      const hexAddress: string =
        chainAdapter[`AddressAdapter_${chainId}`](address);
      return hexAddress;
    } catch (e) {
      logger.error("error processing address");
      logger.warn("unknown format");
    }
    logger.warn("unknown format");
    return address;
  }

  public getHedgeConfig() {
    return this.hedgeConfig;
  }

  public getLpConfig() {
    return this.lpConfig;
  }

  public getChainGasTokenUsd(chainId: number): number {
    if (!_.isFinite(chainId)) {
      return 0;
    }
    const usd = this.chainTokenUsd.get(chainId);
    if (!usd) {
      return 0;
    }
    return usd;
  }

  public getChainGasTokenUsdMax(chainId: number): number {
    if (!_.isFinite(chainId)) {
      return 0;
    }
    const usd = this.chainMaxTokenUsd.get(chainId);
    if (!usd) {
      return 0;
    }
    return usd;
  }

  /**
   * sync config from database
   * @date 1/18/2023 - 2:08:47 PM
   *
   * @public
   * @async
   * @returns {Promise<void>} ""
   */
  public async syncBridgeConfigFromLocalDatabase(): Promise<void> {
    const appName = _.get(process, "_sys_config.app_name", null);
    if (!appName) {
      logger.error("AppName is null");
      process.exit(1);
    }
    const findOption = { ammName: appName };
    logger.debug(`syncBridgeConfigFromLocalDatabase,findOption:`, findOption);
    const lpConfigList: {
      _id: string;
      bridgeName: string;
      srcChainId: number;
      dstChainId: number;
      srcToken: string;
      dstToken: string;
      msmqName: string;
      walletName: string;
      srcClientUri: string;
      dstClientUri: string;
    }[] = await bridgesModule.find(findOption).lean();
    this.bridgeTokenList = [];
    logger.info(`loaded BridgeConfigs count: [${lpConfigList.length}] `);
    if (!lpConfigList || lpConfigList.length <= 0) {
      logger.warn(
        "Did not find any available BridgeItem",
        "findOption",
        findOption
      );
      await TimeSleepMs(1000 * 20);
      process.exit(1);
    }
    for (const item of lpConfigList) {
      const formatedItem: any = {
        id: item._id,
        bridge_name: item.bridgeName,
        src_chain_id: item.srcChainId,
        dst_chain_id: item.dstChainId,
        srcToken: item.srcToken,
        dstToken: item.dstToken,
        msmq_name: item.msmqName,
        wallet: {
          name: item.walletName,
          balance: {},
        },
        fee: undefined,
        dst_chain_client_uri: item.dstClientUri,
        src_chain_client_url: item.srcClientUri,
        enable_hedge: false,
      };
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const context = this;
      const proxyedFormatedItem: IBridgeTokenConfigItem = this.extendFun(
        formatedItem,
        context
      );
      this.bridgeTokenList.push(proxyedFormatedItem);
    }
    const hedgeTokenList = _.filter(this.bridgeTokenList, (item) => {
      return item.enable_hedge === true;
    });
    await this.loadBridgeConfig();
    if (_.isArray(hedgeTokenList) && hedgeTokenList.length >= 1) {
      logger.info(`check hedging configuration`, "🌎");
      if (!this.hedgeAvailable()) {
        await TimeSleepForever("please add hedging account configuration");
      }
    }
    console.log("bridge tokens:\r\n");
    console.table(this.bridgeTokenList);
  }

  public getBridgeBaseConfig() {
    return _.get(this.baseConfig, "bridgeBaseConfig", undefined);
  }

  private async loadBridgeConfig() {
    if (
      _.get(this.baseConfig, "bridgeBaseConfig.enabledHedge", undefined) ===
      undefined
    ) {
      logger.debug("bridgeBaseConfig.enabledHedge Can not be empty");
      await TimeSleepForever("bridgeBaseConfig.enabledHedge Can not be empty");
      return;
    }
    const bridgeConfig = _.get(this.baseConfig, "bridgeConfig", []);
    const defHedgeSetting = _.get(
      this.baseConfig,
      "bridgeBaseConfig.enabledHedge",
      false
    );
    const defFeeSetting = _.get(
      this.baseConfig,
      "bridgeBaseConfig.defaultFee",
      false
    );
    logger.debug(
      `system default value`,
      "defHedgeSetting:",
      defHedgeSetting,
      "defFeeSetting:",
      defFeeSetting
    );
    this.bridgeTokenList = this.bridgeTokenList.map((it) => {
      const itemConfig = _.find(bridgeConfig, { bridgeId: it.id.toString() });
      if (itemConfig) {
        it.fee = _.get(itemConfig, "fee", undefined);
        if (it.fee === undefined) {
          logger.warn(`fee is undefined`);
        }
        it.enable_hedge = _.get(itemConfig, "enableHedge", defHedgeSetting);
      } else {
        it.fee = _.get(itemConfig, "fee", defFeeSetting);
        it.enable_hedge = _.get(itemConfig, "enableHedge", defHedgeSetting);
      }
      return it;
    });
  }

  private hedgeAvailable(): boolean {
    if (this.getHedgeConfig().hedgeType === IHedgeType.Null) {
      return false;
    }
    if (this.getHedgeConfig().hedgeAccount === "") {
      return false;
    }
    return true;
  }

  public getChainName(chainId: number): string | undefined {
    return this.chainMap.get(chainId);
  }

  /**
   * get Chain NativeToken Name
   * @date 1/31/2023 - 11:48:04 AM
   *
   * @public
   * @param {string} chainId chainId
   * @returns {*} ""
   */
  public getChainTokenName(chainId: number) {
    const tokenName = this.chainTokenMap.get(chainId);
    if (!tokenName) {
      logger.error("No configuration data for the base connection found");
      throw new Error("No chain base configuration found");
    }
    return tokenName;
  }

  public getChainTokenMap() {
    return this.chainTokenMap;
  }

  public getBridgeTokenList(): IBridgeTokenConfigItem[] {
    return this.bridgeTokenList;
  }

  public findItemByMsmqName(name: string) {
    const ret: any = _.find(this.bridgeTokenList, {
      msmq_name: name,
    });
    return ret;
  }

  public getPrecision(hexAddress: string) {
    const findHex = hexAddress.toLowerCase();

    this.tokenToSymbolMap.forEach((item) => {
      if (item.addressLower === findHex) {
        return item;
      }
    });
    logger.error("precision not found");
    throw new Error(`precision not found ${hexAddress}`);
  }
}

const dataConfig: DataConfig = new DataConfig();
export { dataConfig };
