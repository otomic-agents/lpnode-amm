/* eslint-disable array-callback-return */
/* eslint-disable arrow-parens */
/**
 * Maintain the balance of the payment wallet on the chain, and use it for reference when quoting, whether there is enough amount
 */
import * as _ from "lodash";
import { dataConfig } from "../data_config";
import { logger } from "../sys_lib/logger";
import { default as axios } from "axios";
import { getNumberFrom16 } from "../utils/ethjs_unit";
// @ts-ignore
const cTable = require("console.table");
import { AsyncEach } from "../sys_lib/async_each";
import { eventBus } from "../sys_lib/event.bus";
import { IBridgeTokenConfigItem } from "../interface/interface";
import { systemRedisBus } from "../system_redis_bus";
import { statusReport } from "../status_report";

// const var_dump = require("var_dump");

interface IChainListItem {
  chainId: number;
  clientUri: string;
}

class ChainBalance {
  private bridgeItemList: IBridgeTokenConfigItem[] = [];
  // @ts-ignore
  private chainWalletBalance: {
    [key: string]: {
      // Cid
      [key: string]: {
        // wallet Name
        wallet_name: string;
        address: string;
        balance: {
          [key: string]: {
            token: string;
            source: string;
            balance: number;
            decimals: number;
          };
        }; // {tokenaddress:value}
      };
    };
  } = {};

  public async init() {
    this.bridgeItemList = dataConfig.getBridgeTokenList();
    systemRedisBus.on("bridgeUpdate", async () => {
      await dataConfig.syncBridgeConfigFromLocalDatabase();
      this.bridgeItemList = dataConfig.getBridgeTokenList();
      logger.info(
        `update bridgeList [chainBalance]`,
        this.bridgeItemList.length
      );
    });
    this.intervalSyncBalance();
    setInterval(() => {
      this.reportBalanceInfo();
    }, 1000 * 60);
  }

  private intervalSyncBalance() {
    logger.debug(`sync dex account balance`);
    const chainList: IChainListItem[] = this.uniqDstChain();
    this.getChainWalletInfo(chainList).then(async () => {
      logger.debug("emit", "balance:load:complete");
      // await TimeSleepMs(1000 * 20);
      eventBus.emit("balance:load:complete");
    });
    setTimeout(() => {
      this.intervalSyncBalance();
    }, 1000 * 15);
  }

  // get chain wallet info
  private async getChainWalletInfo(chainList: IChainListItem[]) {
    const eachFun = async (item: IChainListItem) => {
      let reqUrl = `${item.clientUri}/lpnode/get_wallets`;
      if (_.get(process.env, "UseTestWalletsUrl", "false") === "true") {
        const reqUrlHost = _.get(process.env, "TestWalletsHost", "");
        reqUrl = `${reqUrlHost}/lpnode/get_wallets`;
        if (reqUrl === "") {
          logger.error("address empty ");
          return;
        }
      }
      logger.debug(`request url ............${reqUrl}`);
      let ret: any;
      try {
        ret = await axios.request({
          url: reqUrl,
          method: "POST",
        });
        const serviceCode = _.get(ret, "data.code", 1);
        if (serviceCode !== 200) {
          logger.error(`${reqUrl}`, serviceCode);
          throw new Error("The server returned an error. status !==200");
        }
        logger.debug("client response", _.get(ret, "data.data", {}));
        this.setRemoteInfoToLocalBalance(
          _.get(ret, "data.data", {}),
          item.chainId
        );
        
      } catch (e) {
        const err: any = e;

        logger.error(
          `An error occurred with the request :${reqUrl} dex balance sync error:${err.toString()}`
        );
        logger.warn("response on error:",_.get(ret, "data"));
      }
    };
    await AsyncEach(chainList, eachFun);
    // var_dump(this.chainWalletBalance);
  }

  /**
   * Description Get balance from wallet structure
   * @date 1/17/2023 - 9:05:18 PM
   * @public
   * @param {number} chainId 9006
   * @param {string} walletName a001
   * @param {string} token address
   * @returns {*} cex balance number
   */
  public getBalance(chainId: number, walletName: string, token: string): any {
    const uniqToken = dataConfig.convertAddressToUniq(token, chainId);
    const findKey = `Cid_${chainId}.${walletName}.balance.${uniqToken}.balance`;
    logger.debug(`Get Balance:Find Key ${findKey},tokenInfo ${token}`);
    const balance = Number(_.get(this.chainWalletBalance, findKey, 0));
    if (!_.isFinite(balance)) {
      logger.error(`balance is not a number`);
    }
    logger.info({ findKey, balance });
    return balance;
  }

  private setRemoteInfoToLocalBalance(
    info: {
      wallet_name: string;
      token: string;
      wallet_address: string;
      balance_value: {
        type: string;
        hex: string;
      };
      decimals?: number;
    }[],
    chainId: number
  ) {
    if (!_.isArray(info) || info.length <= 0) {
      logger.debug(info);
      logger.warn("Information returned may be incorrect");
    }
    for (const item of info) {
      const uniqToken = dataConfig.convertAddressToUniq(item.token, chainId);
      _.set(
        this.chainWalletBalance,
        `Cid_${chainId}.${item.wallet_name}.balance.${uniqToken}`,
        {
          token: item.token,
          source: item.balance_value.hex,
          balance: this.formatChainBalance(
            item.balance_value.hex,
            item.decimals
          ),
          decimals: item.decimals,
        }
      ); // Set balance first so that it will not be overwritten
      _.set(this.chainWalletBalance, `Cid_${chainId}.${item.wallet_name}`, {
        wallet_name: item.wallet_name,
        address: item.wallet_address,
        addressLower: item.wallet_address.toLowerCase(),
        balance: _.get(
          this.chainWalletBalance,
          `Cid_${chainId}.${item.wallet_name}.balance`
        ),
      });
    }
  }

  // @ts-ignore
  private reportBalanceInfo() {
    const balanceList: {
      chainId: string;
      walletName: string;
      token: string;
      balanceId: string;
      balance: number;
      balanceRaw: string;
      decimals: number | undefined;
      symbol: string | any;
    }[] = [];
    // eslint-disable-next-line array-callback-return
    Object.keys(this.chainWalletBalance).map((chainId) => {
      // eslint-disable-next-line array-callback-return
      Object.keys(this.chainWalletBalance[chainId]).map((walletName) => {
        // eslint-disable-next-line array-callback-return
        Object.keys(
          this.chainWalletBalance[chainId][walletName]["balance"]
        ).map((balanceId) => {
          const item =
            this.chainWalletBalance[chainId][walletName]["balance"][balanceId];
          balanceList.push({
            chainId,
            walletName,
            balanceId,
            token: _.get(item, "token", ""),
            symbol: _.attempt(() => {
              const symbol = dataConfig.getSymbolInfoByToken(
                _.get(item, "token", ""),
                Number(chainId.replace("Cid_", ""))
              );
              const marketSymbol = _.get(symbol, "symbol", "--");
              const symbolName = _.get(symbol, "tokenName", "--");
              return `tokenName:${symbolName},market:${marketSymbol}`;
            }),
            balance: _.get(item, "balance", 0),
            balanceRaw: _.get(item, "source", ""),
            decimals: _.get(item, "decimals", undefined),
          });
        });
      });
    });
    statusReport.appendStatus("dex_balance", balanceList);
    console.table(balanceList);
  }

  private formatChainBalance(
    hexBalance: string,
    decimals: number | undefined
  ): number {
    if (!decimals) {
      logger.error("The balance unit is incorrect");
      return 0;
    }
    const balance = getNumberFrom16(hexBalance, decimals);
    return balance;
  }

  /**
   * Description Deduplicate the chain
   * @date 2/1/2023 - 7:52:01 PM
   *
   * @private
   * @returns {*} ""
   */
  private uniqDstChain(): { chainId: number; clientUri: string }[] {
    const tokenList = this.bridgeItemList;
    const ret: { chainId: number; clientUri }[] = [];
    const cacheChainId: Map<number, boolean> = new Map();
    for (const item of tokenList) {
      const dstChainId = item.dst_chain_id;
      const srcChainId = item.src_chain_id;
      if (!cacheChainId.get(dstChainId)) {
        cacheChainId.set(dstChainId, true);
        ret.push({
          chainId: item.dst_chain_id,
          clientUri: item.dst_chain_client_uri,
        });
      }
      if (!cacheChainId.get(srcChainId)) {
        cacheChainId.set(srcChainId, true);
        ret.push({
          chainId: item.src_chain_id,
          clientUri: item.src_chain_client_url,
        });
      }
    }
    // console.table(ret);
    return ret;
  }
}

const chainBalance: ChainBalance = new ChainBalance();
export { chainBalance };
