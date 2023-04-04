/* eslint-disable arrow-parens */
import { chainAdapter } from "./chain_adapter/chain_adapter";

/**
 * 从基础数据、环境变量、Httpd 中组合项目的配置
 */
const bs58 = require("bs58");
import * as _ from "lodash";
import {
  IBridgeTokenConfigItem,
  ICexCoinConfig,
  ICoinType,
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
import { statusReport } from "./status_report";

const Web3 = require("web3");
const web3 = new Web3();

class DataConfig {
  private hedgeConfig: IHedgeConfig = {
    hedgeType: IHedgeType.Null,
    hedgeAccount: "",
  };
  private chainTokenUsd: Map<number, number> = new Map();
  private chainMap: Map<number, string> = new Map();
  private chainTokenMap: Map<number, string> = new Map(); // 链id 和Market Symbol之间的关系
  private tokenToSymbolMap: Map<string, ICexCoinConfig> = new Map();
  private hedgeAccountList: {
    accountId: string;
    exchangeName: string;
    spotAccount: {
      apiKey: string;
      apiSecret: string;
    };
    usdtFutureAccount: {
      apiKey: string;
      apiSecret: string;
    };
    coinFutureAccount: {
      apiKey: string;
      apiSecret: string;
    };
  }[] = [];
  private lpConfig: {
    quotationInterval: number;
  } = {
    quotationInterval: 1000 * 10,
  };

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
   * Description 准备admin的Config
   * @date 2023/3/21 - 16:06:24
   *
   * @public
   * @async
   * @returns {*} "无返回"
   */
  public async prepareConfigResource() {
    let configId: string | null;
    let clientId: string;
    let configIdKey = "";
    try {
      const appName = _.get(process.env, "APP_NAME", null);
      if (!appName) {
        logger.error("Appname无法获取");
        await TimeSleepMs(3000);
        process.exit(1);
      }
      configIdKey = `config_id_${appName}`;
      configId = await dataRedis.get(configIdKey);
      if (configId == null) {
        throw new Error("没有从redis中获取到对应的配置");
      }
    } catch (e) {
      const err: any = e;
      logger.warn("没有找到ConfigId", err.toString());
      [configId, clientId] = await this.createConfigResource();
      if (!clientId) {
        logger.error("无法去远端创建资源");
        process.exit(0);
      }
      await dataRedis.set(configIdKey, clientId)
        .then(() => {
          console.log("设置ClientId 到持久化数据库中成功", clientId);
        });
      await (() => {
        return new Promise(() => {
          statusReport.pendingStatus("等待配置完成")
            .catch((e) => {
              logger.error(`写入状态失败`, e);
            });
          logger.warn("等待配置完成..");
        });
      })();
    }
    if (configId == null) {
      logger.error("没有读取到正确的configId");
      process.exit(1);
    }
    logger.debug(`configId is:${configId} clientId`);
    const baseConfig: any = await this.getConfigResource(configId);
    await this.initBaseConfig(baseConfig);
  }

  public async rewriteMarketUrl() {
    const rewrite = _.get(process.env, "rewrite_market_host", "true");
    if (rewrite === "false") {
      logger.warn(`跳过rewrite`);
      return;
    }
    const marketServiceRow = await installModule
      .findOne({
        installType: "market",
      })
      .lean();
    if (!marketServiceRow) {
      logger.error(`没有找到正确的market地址，无法覆盖默认值`);
      await statusReport.pendingStatus("没有找到正确的market地址,无法覆盖默认值");
      await TimeSleepForever("没有找到正确的market地址,无法覆盖默认值");
    } else {
      const rewriteHost = `obridge-amm-market-${marketServiceRow.name}-service`;
      logger.warn("rewrite market host ", rewriteHost);
      _.set(process, "_sys_config.lp_market_host", rewriteHost);
    }
    await TimeSleepMs(5000);
  }

  private async initBaseConfig(baseConfig: any) {
    console.log(baseConfig);
    const chainDataConfigList: {
      chainId: number;
      config: { minSwapNativeTokenValue: string };
    }[] = _.get(baseConfig, "chainDataConfig", []);
    for (const chainData of chainDataConfigList) {
      this.chainTokenUsd.set(
        chainData.chainId,
        Number(chainData.config.minSwapNativeTokenValue),
      );
      logger.debug(
        "set chain usd",
        chainData.chainId,
        Number(chainData.config.minSwapNativeTokenValue),
      );
    }
    let hedgeType = _.get(baseConfig, "hedgeConfig.hedgeType", null);
    const hedgeAccount = _.get(baseConfig, "hedgeConfig.hedgeAccount", null);
    if (!hedgeType || !hedgeAccount) {
      logger.error(`基础配置数据不正确`);
      await TimeSleepForever("基础配置数据不正确,等待重新配置");
    }
    if (hedgeType === "null" || !hedgeType) {
      hedgeType = "Null";
    }
    this.hedgeConfig.hedgeType = hedgeType;
    this.hedgeConfig.hedgeAccount = hedgeAccount;
    this.hedgeAccountList = _.get(baseConfig, "hedgeConfig.accountList", []);
    if (hedgeAccount.length <= 0) {
      logger.error(`基础配置数据不正确,请检查对冲账号设置`);
      await TimeSleepForever("基础配置数据不正确,等待重新配置");
    }
  }

  public getHedgeAccountList() {
    return this.hedgeAccountList;
  }

  private async getConfigResource(configId: string) {
    let result;
    const lpAdminPanelUrl = appEnv.GetLpAdminUrl();
    const url = `${lpAdminPanelUrl}/lpnode/lpnode_admin_panel/configResource/get`;
    logger.info(`开始请求:${url}`);
    try {
      result = await axios.request({
        url,
        method: "post",
        data: {
          clientId: configId,
        },
      });
      const configData = JSON.parse(
        _.get(result, "data.result.templateResult", {}),
      );
      return configData;
    } catch (e) {
      const err: any = e;
      logger.error(`获取配置发生了错误`, err.toString());
    }
  }

  private async createConfigResource() {
    let result: any;
    const lpAdminPanelUrl = appEnv.GetLpAdminUrl();
    try {
      result = await axios.request({
        url: `${lpAdminPanelUrl}/lpnode/lpnode_admin_panel/configResource/create`,
        method: "post",
        data: {
          appName: _.get(process.env, "APP_NAME", ""),
          version: _.get(process.env, "APP_VERSION", ""),
          clientId: Buffer.from(new Date().getTime()
            .toString())
            .toString(
              "base64",
            ),
          template:
            '{"chainDataConfig":[{"chainId":9006,"config":{"minSwapNativeTokenValue":"0.5"}},{"chainId":9000,"config":{"minSwapNativeTokenValue":"0.5"}}],"hedgeConfig":{"hedgeAccount":"a001","hedgeType":"CoinSpotHedge","accountList":[{"accountId":"a001","exchangeName":"binance","spotAccount":{"apiKey":"","apiSecret":""},"usdtFutureAccount":{"apiKey":"","apiSecret":""},"coinFutureAccount":{"apiKey":"","apiSecret":""}}]}}',
        },
      });
      logger.debug("创建配置返回", _.get(result, "data", ""));
      const id = _.get(result, "data.result.id", "");
      const clientId = _.get(result, "data.result.clientId", "");
      if (!id || id === "" || !clientId || clientId === "") {
        logger.error("无法为服务创建配置，无法启动, Lp_admin返回不正确");
        process.exit(5);
      }
      return [id, clientId];
    } catch (e) {
      const err: any = e;
      logger.error(
        "创建配置发生了错误",
        err.toString(),
        _.get(e, "response.data", ""),
      );
    }
    return [];
  }

  public async loadBaseConfig() {
    setInterval(() => {
      // 自动定期刷新TokenList
      this.loadTokenToSymbol()
        .catch((e) => {
          logger.error("同步TokenList出错");
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
    }[] = await tokensModule
      .find({
        ammName: _.get(process.env, "APP_NAME", ""),
      })
      .lean();
    // 同步的内容一定放在一起，保证同步币对，不会影响其它地方的报价
    this.tokenToSymbolMap = new Map();
    this.tokenToSymbolMap.set("0x0", {
      address: "0_0x0",
      addressLower: "0_0x0",
      chainId: 0,
      coinType: ICoinType.StableCoin,
      symbol: "USDT",
      precision: 6,
    });
    this.tokenToSymbolMap.set("0x1", {
      address: "0_0x1",
      addressLower: "0_0x1",
      chainId: 0,
      coinType: ICoinType.StableCoin,
      symbol: "USDC",
      precision: 6,
    });
    this.tokenToSymbolMap.set("0x2", {
      address: "0_0x2",
      addressLower: "0_0x2",
      chainId: 0,
      coinType: ICoinType.StableCoin,
      symbol: "BUSD",
      precision: 6,
    });
    tokenList.map((it) => {
      const uniqAddress = this.convertAddressToUniq(it.address, it.chainId);
      const key = `${it.chainId}_${uniqAddress}`;
      this.tokenToSymbolMap.set(key, {
        chainId: it.chainId,
        address: this.convertAddressToHex(it.address, it.chainId),
        addressLower: this.convertAddressToHex(it.address, it.chainId)
          .toLowerCase(),
        coinType: it.coinType,
        symbol: it.marketName,
        precision: it.precision,
      });
      return null;
    });
    console.log("当前配置好的Token列表:");
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

    await TimeSleepMs(1000 * 5);
  }

  private async loadChainConfig() {
    const chainList: {
      chainId: number;
      chainName: string;
      tokenName: string;
      tokenUsd: number;
    }[] = await chainListModule.find({})
      .lean();

    _.map(chainList, (item) => {
      this.chainMap.set(item.chainId, item.chainName);
      this.chainTokenMap.set(item.chainId, item.tokenName);
    });
    console.log("当前链的基础数据:");
    console.table(chainList);
    await TimeSleepMs(5 * 1000);
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
    token1ChainId: number,
  ): ICexCoinConfig[] | any {
    const uniqAddress0 = this.convertAddressToUniq(token0, token0ChainId);
    const uniqAddress1 = this.convertAddressToUniq(token1, token1ChainId);
    const key0 = `${token0ChainId}_${uniqAddress0}`;
    const key1 = `${token1ChainId}_${uniqAddress1}`;
    const token0Symbol = this.tokenToSymbolMap.get(key0);
    const token1Symbol = this.tokenToSymbolMap.get(key1);
    if (!token0Symbol || !token1Symbol) {
      logger.warn(`没有找到需要查询的币对 【${token0}/${token1}】`);
      return undefined;
    }
    return [token0Symbol, token1Symbol];
  }

  private convertAddressToUniq(address: string, chainId: number): string {
    if (address.startsWith("0x")) {
      return web3.utils.hexToNumberString(address);
    }
    if (chainId === 397) {
      const bytes = bs58.decode(address);
      const ud = web3.utils.hexToNumberString(
        `0x${Buffer.from(bytes)
          .toString("hex")}`,
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
      const hexAddress: string = chainAdapter[`AddressAdapter_${chainId}`](address);
      return hexAddress;
    } catch (e) {
      logger.error("处理地址发生了错误");
      logger.warn("未知的格式");
    }
    logger.warn("未知的格式");
    return address;
  }

  public getHedgeConfig() {
    return this.hedgeConfig;
  }

  public getLpConfig() {
    return this.lpConfig;
  }

  /**
   * Description 获取目标链换Gas Token 至少要价值的U
   * @date 2/1/2023 - 4:12:31 PM
   *
   * @public
   * @param {number} chainId "目标链的id"
   * @returns {number} "配置好的U"
   */
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
    return 0;
  }

  /**
   * Description 从Lp的缓存池中启动
   * @date 1/18/2023 - 2:08:47 PM
   *
   * @public
   * @async
   * @returns {Promise<void>} ""
   */
  public async syncBridgeConfigFromLocalDatabase(): Promise<void> {
    const appName = _.get(process, "_sys_config.app_name", null);
    if (!appName) {
      logger.error("读取配置时,没有找到AppName.");
      process.exit(1);
    }
    const findOption = { ammName: appName };
    const lpConfigList: {
      bridgeName: string;
      srcChainId: number;
      dstChainId: number;
      srcToken: string;
      dstToken: string;
      msmqName: string;
      walletName: string;
      dstClientUri: string;
    }[] = await bridgesModule.find()
      .lean();
    this.bridgeTokenList = [];
    if (!lpConfigList || lpConfigList.length <= 0) {
      logger.warn(
        "没有查询到任何可用的BridgeItem配置",
        "findOption",
        findOption,
      );
      await TimeSleepMs(1000 * 10);
      process.exit(1);
    }
    for (const item of lpConfigList) {
      const formatedItem = {
        bridge_name: item.bridgeName,
        src_chain_id: item.srcChainId,
        dst_chain_id: item.dstChainId,
        srcToken: item.srcToken,
        dstToken: item.dstToken,
        msmq_name: item.msmqName,
        wallet: {
          name: item.walletName, // 把钱包地址也初始化，报价的时候要能够处理余额
          balance: {},
        },
        dst_chain_client_uri: item.dstClientUri,
      };
      this.bridgeTokenList.push(formatedItem);
    }
    console.table(this.bridgeTokenList);
  }

  public getChainName(chainId: number): string | undefined {
    return this.chainMap.get(chainId);
  }

  /**
   * 返回目标链的token币名称
   * @date 1/31/2023 - 11:48:04 AM
   *
   * @public
   * @param {string} chainId chainId
   * @returns {*} ""
   */
  public getDstChainTokenName(chainId: number) {
    return this.chainTokenMap.get(chainId);
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

    this.tokenToSymbolMap.forEach(item => {
      if (item.addressLower === findHex) {
        return item;
      }
    });
    logger.error("没有找到对应的Precision");
    throw new Error(`没有找到对应的Precision ${hexAddress}`);
  }
}

const dataConfig: DataConfig = new DataConfig();
export { dataConfig };
