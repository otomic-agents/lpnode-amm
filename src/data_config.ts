/* eslint-disable arrow-parens */
import { chainAdapter } from "./chain_adapter/chain_adapter";
import { NestApplicationContext } from '@nestjs/core';
import { HedgeDataService } from './nestjs/HedgeData/hedge_data.service';
import * as fs from "fs";
import * as _ from "lodash";
import {
  IBridgeTokenConfigItem,
  ICexCoinConfig,
  IHedgeConfig,
  IHedgeType,
  ISpecialTokenConfig
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
import { HedgeTask } from "./nestjs/HedgeData/interface";



class DataConfig {
  private baseConfig: any;
  private hedgeConfig: IHedgeConfig = {
    hedgeType: IHedgeType.Null,
    hedgeAccount: "",
    feeSymbol: "",
  };
  private specialTokenConfig: Map<string, ISpecialTokenConfig> = new Map();

  private chainTokenUsd: Map<number, number> = new Map();
  // @ts-ignore
  private chainMaxTokenUsd: Map<number, number> = new Map();
  private chainMap: Map<number, string> = new Map();
  private chainDataMap: Map<
    number,
    { chainType: string; nativeTokenPrecision: number }
  > = new Map();
  private chainTokenMap: Map<number, string> = new Map();
  private tokenToSymbolMap: Map<string, ICexCoinConfig> = new Map();
  private rawChainDataConfig: {
    chainId: number;
    config: {
      maxSwapNativeTokenValue: string;
      minSwapNativeTokenValue: string;
      timeLimitForLock?: number;
    };
  }[] = [];
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
  private hedgeDataService: HedgeDataService;
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
  public async init( service: {
    hedgeDataService: HedgeDataService
  }): Promise<void> {
    this.hedgeDataService = service.hedgeDataService;
  }
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
        logger.error("🚫 Application name not found in environment variables");
        await TimeSleepMs(3000);
        process.exit(1);
      }
      configIdKey = `config_id_${appName}`;
      configId = await dataRedis.get(configIdKey);
      if (configId == null) {
        throw new Error("🔍 Unable to retrieve configuration from Redis, [configId is not exist]");
      }
      logger.debug(`🔑 Active configuration ID: ${configId}`)
      await this.getConfigResource(configId);
    } catch (e) {
      const err: any = e;
      logger.warn("⚠️ Configuration ID not found in system", err.toString());
      const errMessage = err.toString();
      if (
        errMessage.includes("configId is not exist") ||
        errMessage.includes("unable to get config from redis")
      ) {
        logger.error("⛔ Configuration ID does not exist in the system");
        const [createConfigId, createClientId] =
          await this.createConfigResource();
        configId = createConfigId;
        clientId = createClientId;
        if (!clientId) {
          logger.error("❌ Failed to create remote resources");
          process.exit(0);
        }
        await dataRedis.set(configIdKey, clientId).then(() => {
          console.log("💾 Successfully stored client ID in database:", clientId);
        });
        await (() => {
          return new Promise(() => {
            this.statusReport
              .pendingStatus("⏳ Configuration in progress, please wait...")
              .catch((e: any) => {
                logger.error(`🔥 Status update failed`, e);
              });
            logger.warn("⌛ Waiting for configuration process to complete...");
          });
        })();
      }
    }
    if (!configId) {
      logger.error("❌ Failed to obtain valid configuration ID");
      process.exit(1);
    }
    logger.debug(`🔑 Active configuration ID: ${configId}`);
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
  public getRawChainDataConfig() {
    return this.rawChainDataConfig;
  }

  private async initBaseConfig(baseConfig: any) {
    logger.info("🔄 Loading base configuration:", JSON.stringify(baseConfig));
    this.baseConfig = baseConfig;
    try {
      this.checkBaseConfig(baseConfig);
    } catch (e) {
      logger.debug(e);
      logger.error(`⚠️ Invalid base configuration structure detected`);
      await TimeSleepForever(
        "🚨 Configuration validation failed - awaiting new configuration data"
      );
    }
    const chainDataConfigList: {
      chainId: number;
      config: {
        minSwapNativeTokenValue: string;
        maxSwapNativeTokenValue: string;
      };
    }[] = _.get(baseConfig, "chainDataConfig", []);
    this.rawChainDataConfig = chainDataConfigList;
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
        `🔗 Chain ${chainData.chainId}:`,
        "Min swap value: $",
        Number(chainData.config.minSwapNativeTokenValue),
        "Max swap value: $",
        Number(chainData.config.maxSwapNativeTokenValue)
      );
    }
    
    const specialTokens = _.get(baseConfig, "specialTokenConfig.orderBookConfig", []);
    this.specialTokenConfig.clear();
    for (const token of specialTokens) {
      this.specialTokenConfig.set(token.symbol, {
        symbol: token.symbol,
        orderBookConfig: token,
      });
    }
  }
  public getSpecialTokenConfig(symbol: string): ISpecialTokenConfig | undefined {
    return this.specialTokenConfig.get(symbol);
  }
  public isSpecialToken(symbol: string): boolean {
    return this.specialTokenConfig.has(symbol);
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

  public async  getHedgeAccountList() {
    return this.hedgeDataService.getHedgeAccountList();
    // return this.hedgeAccountList;
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
      '{"chainDataConfig":[{"chainId":9006,"config":{"maxSwapNativeTokenValue":"50000","minSwapNativeTokenValue":"0.5"}}],"bridgeBaseConfig":{"minChargeUsdt": "0.002","defaultFee":"0.003","enabledHedge":false},"bridgeConfig":[],"orderBookType":"market","hedgeConfig":{"hedgeAccount":"001","hedgeType":"CoinSpotHedge","accountList":[{"enablePrivateStream":false,"apiType":"exchange_adapter","accountId":"001","exchangeName":"binance","spotAccount":{"apiKey":"","apiSecret":""},"usdtFutureAccount":{"apiKey":"","apiSecret":""},"coinFutureAccount":{"apiKey":"","apiSecret":""}}]}}';
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
    await this.loadChainConfig();
    await this.loadTokenToSymbol();
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
      console.log(it.address, "🚁🚁🚁🚁🚁🚁🚁🚁🚁🚁🚁🚁🚁🚁🚁🚁🚁");
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
      precision: number;
    }[] = await chainListModule.find({}).lean();

    _.map(chainList, (item) => {
      this.chainMap.set(item.chainId, item.chainName);
      logger.info(item.chainId, item.chainType, "0000000--");
      this.chainDataMap.set(item.chainId, {
        chainType: item.chainType,
        nativeTokenPrecision: item.precision,
      });
      this.chainTokenMap.set(item.chainId, item.tokenName);
    });
    console.log("chain base data:");
    console.table(chainList);
    await TimeSleepMs(100);
  }

  public getStdCoinSymbolInfoByToken(
    token: string,
    chainId: number
  ): { symbol: string | null; coinType: string } {
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
    // logger.debug(token0Symbol,token1Symbol,"🚁🚁🚁🚁🚁🚁")
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
      logger.warn("Token was not found", chainId, token, uniqAddress);
      return undefined;
    }
    return tokenSymbol;
  }

  public convertAddressToUniq(address: string, chainId: number): string {
    if (address.startsWith("0x")) {
      return chainAdapter[`AddressToUniq_0`](address);
    }

    try {
      //@ts-ignore
      const ud: string = chainAdapter[`AddressToUniq_${chainId}`](address);
      return ud;
    } catch (e) {
      logger.error("unprocessable address.", address);
      throw new Error("unprocessable address.");
    }
  }

  private convertAddressToHex(address: string, chainId: number): string {
    if (address.startsWith("0x")) {
      return address;
    }
    try {
      const hexAddress: string =
        //@ts-ignore
        chainAdapter[`AddressAdapter_${chainId}`](address);
      return hexAddress;
    } catch (e) {
      logger.error("error processing address");
      logger.warn("unknown format");
    }
    logger.warn("unknown format");
    return address;
  }

  public async getHedgeConfig():Promise<IHedgeConfig> {
    return await this.hedgeDataService.getHedgeConfig();
  }
  public async isHedgeEnable(bridgeId:string):Promise<boolean> {
    const hedgeConfig = await this.hedgeDataService.getHedgeByBridgeId(bridgeId)
    if (hedgeConfig!=null && hedgeConfig){
      return true;
    }
    return false;
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
      logger.warn(
        "There is no configuration for the maximum limit of native tokens."
      );
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
      relayApiKey: string;

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
        msmq_path: item.msmqName + "_" + item.relayApiKey,
        wallet: {
          name: item.walletName,
          balance: {},
        },
        fee: undefined,
        dst_chain_client_uri: item.dstClientUri,
        src_chain_client_url: item.srcClientUri,
        enable_hedge: false,
        relay_api_key: item.relayApiKey,
      };
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const context = this;
      const proxyedFormatedItem: IBridgeTokenConfigItem = this.extendFun(
        formatedItem,
        context
      );
      this.bridgeTokenList.push(proxyedFormatedItem);
    }
    await this.loadBridgeConfig();
    
    console.log("bridge tokens:\r\n");
    console.table(this.bridgeTokenList);
  }

  public getBridgeBaseConfig() {
    return _.get(this.baseConfig, "bridgeBaseConfig", undefined);
  }

  private async loadBridgeConfig() {
    const defHedgeSetting = false
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
    const minChargeUsdt = _.get(
      this.baseConfig,
      "bridgeBaseConfig.minChargeUsdt",
      0
    );
    if (minChargeUsdt === 0) {
      logger.debug("bridgeBaseConfig.minChargeUsdt Can not be empty");
      await TimeSleepForever("bridgeBaseConfig.minChargeUsdt Can not be empty");
      return;
    }
    for (let i = 0; i < this.bridgeTokenList.length; i++) {
      const it = this.bridgeTokenList[i];
      const itemConfig: HedgeTask = await this.hedgeDataService.getHedgeByBridgeId(it.id.toString());
    
      if (itemConfig) {
        it.fee = _.get(itemConfig, "fee", defFeeSetting);
        if (it.fee === undefined) {
          logger.warn(`fee is undefined`);
        }
        
        // Set enable_hedge based on itemConfig.status
        it.enable_hedge = itemConfig.status === 'active';
        
        console.log("\n");
        console.log("⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐");
        console.log(`⭐    HEDGE CONFIG LOADED: ${itemConfig.name.toUpperCase()}    ⭐`);
        console.log(`⭐    HEDGE ENABLED: ${it.enable_hedge}    ⭐`);
        console.log(`⭐    FEE SETTING: ${it.fee}    ⭐`);
        console.log(`⭐    STATUS: ${itemConfig.status}    ⭐`);
        console.log("⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐");
        console.log("\n");
      } else {
        it.fee = defFeeSetting;
        it.enable_hedge = false; // Default to false when no itemConfig exists
      }
    }
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
  public findItemByMsmqPath(name: string) {
    const ret: any = _.find(this.bridgeTokenList, {
      msmq_path: name,
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
    logger.error("Precision data unavailable");
    throw new Error(`Precision data unavailable ${hexAddress}`);
  }
  public getChainNativeTokenPrecision(chainId: number) {
    let chainData = this.chainDataMap.get(chainId);
    if (!chainData) {
      logger.error("Unable to locate chain data");
      throw new Error("Unable to locate chain data ");
    }
    return chainData.nativeTokenPrecision;
  }
}

const dataConfig: DataConfig = new DataConfig();
export { dataConfig };
