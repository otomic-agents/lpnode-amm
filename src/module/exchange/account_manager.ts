import * as _ from "lodash";
import { logger } from "../../sys_lib/logger";
import { AsyncEach } from "../../sys_lib/async_each";
import { StdAccount } from "./account";
import { ICexAccount } from "../../interface/std_difi";
import { dataConfig } from "../../data_config";
import { statusReport } from "../../status_report";

class AccountManager {
  private accountInsList: Map<string, StdAccount> = new Map();

  public async init() {
    logger.debug(`Load accounts list`);
    await this.initAccountsInfo();
    setInterval(() => {
      this.reportStatusToStatusStore();
    }, 1000 * 15);
  }

  public reportStatusToStatusStore() {
    const balanceStore = {};
    this.accountInsList.forEach((stdAccount, accountId) => {
      _.set(
        balanceStore,
        `${accountId}.spotBalance`,
        stdAccount.balance.getAllSpotBalance()
      );
    });
    statusReport
      .appendStatus("cexBalance", balanceStore)
      .then(() => {
        //
      })
      .catch((e) => {
        logger.error(`error reporting status`, e);
        logger.error(e);
      });
  }

  /**
   * Get account instance from the account list
   * @date 1/17/2023 - 9:13:28 PM
   *
   * @public
   * @param {string} accountId "a001"
   * @returns {(StdAccount | undefined)} Hedging account instance
   */
  public getAccount(accountId: string): StdAccount | undefined {
    return this.accountInsList.get(accountId);
  }

  public async initAccountsInfo() {
    const accounts: ICexAccount[] = await dataConfig.getHedgeAccountList();
    console.log(JSON.stringify(accounts));
    await AsyncEach(accounts, async (accountItem: ICexAccount) => {
      const accountIns = new StdAccount(accountItem);
      logger.debug(`initAccountsInfo Store Account instance`, accountItem.accountId);
      await accountIns.init();
      this.accountInsList.set(accountItem.accountId, accountIns);
      logger.debug(`initAccountsInfo Store set  Account instance`, accountItem.accountId);
    });
  }
  public async loadAccounts(accountList: ICexAccount[]) {
    await AsyncEach(accountList, async (accountItem: ICexAccount) => {
      const accountIns = new StdAccount(accountItem);
      logger.debug(`Store Account instance`, accountItem.accountId);
      await accountIns.init();
      this.accountInsList.set(accountItem.accountId, accountIns);
    });
  }
}

const accountManager: AccountManager = new AccountManager();
export { accountManager };
