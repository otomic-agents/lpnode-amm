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
const var_dump = require("var_dump");
interface IChainListItem {
  chainId: number;
  clientUri: string;
}

class ChainBalance {
  private reporting = false;
  // @ts-ignore
  private chainWalletBalance: {
    [key: string]: {
      // Cid
      [key: string]: {
        // wallet Name
        wallet_name: string;
        address: string;
        balance: {
          [key: string]: { source: string; balance: number; decimals: number };
        }; // {tokenaddress:value}
      };
    };
  } = {};
  public init() {
    logger.debug(`sync dex account balance`, "🟥");
    const chainList: IChainListItem[] = this.uniqDstChain();
    this.getChainWalletInfo(chainList).then(async () => {
      logger.debug("emit", "balance:load:complete");
      // await TimeSleepMs(1000 * 20);
      eventBus.emit("balance:load:complete");
    });
    setTimeout(() => {
      this.init();
    }, 1000 * 60 * 10);
    if (!this.reporting) {
      // 仅仅是第一次设置一个定时器，之后重复进入逻辑后，不再处理
      setInterval(() => {
        this.reportBalanceInfo();
      }, 1000 * 60);
    }
  }

  // 获取连上的钱包情况
  private async getChainWalletInfo(chainList: IChainListItem[]) {
    const eachFun = async (item: IChainListItem) => {
      let reqUrl = `${item.clientUri}/lpnode/get_wallets`;
      if (_.get(process.env, "UseTestWalletsUrl", "false") === "true") {
        reqUrl = _.get(process.env, "TestWalletsUrl", "");
        if (reqUrl === "") {
          logger.error("address empty ");
          return;
        }
      }
      logger.debug(`request url ............${reqUrl}`);
      logger.debug(`Request ClientService to get balance data`, reqUrl);
      try {
        const ret = await axios.request({
          url: reqUrl,
          method: "POST",
        });
        const serviceCode = _.get(ret, "data.code", 1);
        if (serviceCode !== 200) {
          logger.error(`${reqUrl}`, serviceCode);
          throw new Error("The server returned an error. status !==200");
        }
        this.setRemoteInfoToLocalBalance(
          _.get(ret, "data.data", {}),
          item.chainId
        );
      } catch (e) {
        const err: any = e;
        logger.error(
          `An error occurred with the request :${reqUrl} dex balance sync error:${err.toString()}`
        );
      }
    };
    await AsyncEach(chainList, eachFun);
    var_dump(this.chainWalletBalance);
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
    const findKey = `Cid_${chainId}.${walletName}.balance.${token}.balance`;
    logger.debug(`Get Balance:Find Key ${findKey}`);
    const balance = Number(_.get(this.chainWalletBalance, findKey, 0));
    if (!_.isFinite(balance)) {
      logger.error(`balance is not a number`);
    }
    logger.info(findKey, balance);
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
    }[],
    chainId: number
  ) {
    for (const item of info) {
      _.set(
        this.chainWalletBalance,
        `Cid_${chainId}.${item.wallet_name}.balance.${item.token}`,
        {
          source: item.balance_value.hex,
          balance: getNumberFrom16(item.balance_value.hex),
          decimals: 0,
        }
      ); // Set balance first so that it will not be overwritten
      _.set(this.chainWalletBalance, `Cid_${chainId}.${item.wallet_name}`, {
        wallet_name: item.wallet_address,
        address: item.wallet_address,
        balance: _.get(
          this.chainWalletBalance,
          `Cid_${chainId}.${item.wallet_name}.balance`
        ),
      });
    }
  }
  // @ts-ignore
  private reportBalanceInfo() {
    this.reporting = true;
    logger.debug("\r\n", "BalanceData:", "\r\n");
    for (const key in this.chainWalletBalance) {
      console.log(
        key,
        "___________________________________________________________________________________________"
      );
      console.log(JSON.stringify(this.chainWalletBalance[key]));
    }
  }

  /**
   * Description Deduplicate the chain
   * @date 2/1/2023 - 7:52:01 PM
   *
   * @private
   * @returns {*} ""
   */
  private uniqDstChain(): { chainId: number; clientUri: string }[] {
    const tokenList = dataConfig.getBridgeTokenList();
    const ret: { chainId: number; clientUri }[] = [];
    const cacheChainId: Map<number, boolean> = new Map();
    for (const item of tokenList) {
      const chainId = item.dst_chain_id;
      if (!cacheChainId.get(chainId)) {
        cacheChainId.set(chainId, true);
        ret.push({
          chainId: item.dst_chain_id,
          clientUri: item.dst_chain_client_uri,
        });
      }
    }
    console.table(ret);
    return ret;
  }
}
const chainBalance: ChainBalance = new ChainBalance();
export { chainBalance };
