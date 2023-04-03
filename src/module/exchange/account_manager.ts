/**
 * 全局一个accountManager
 * 管理所有的对冲账号，每个账号可以对应 Cex 或者 Dex 完成对冲
 */
import * as _ from "lodash";
import { logger } from "../../sys_lib/logger";
import { AsyncEach } from "../../sys_lib/async_each";
import { StdAccount } from "./account";
import { ICexAccount } from "../../interface/std_difi";
import { dataConfig } from "../../data_config";
class AccountManager {
  private accountInsList: Map<string, StdAccount> = new Map();
  public async init() {
    logger.debug(`Load accounts list`);
    await this.initAccountsInfo();
  }

  /**
   * Description 从账号列表中获取一个
   * @date 1/17/2023 - 9:13:28 PM
   *
   * @public
   * @param {string} accountId "a001"
   * @returns {(StdAccount | undefined)} 对冲账号实例
   */
  public getAccount(accountId: string): StdAccount | undefined {
    return this.accountInsList.get(accountId);
  }
  public async initAccountsInfo() {
    const accounts: ICexAccount[] = dataConfig.getHedgeAccountList();
    console.log(JSON.stringify(accounts));
    await AsyncEach(accounts, async (accountItem: ICexAccount) => {
      const accountIns = new StdAccount(accountItem);
      logger.debug(`Store Account instance`, accountItem.accountId);
      await accountIns.init(); // 初始化Account
      this.accountInsList.set(accountItem.accountId, accountIns);
    });
  }
}
const accountManager: AccountManager = new AccountManager();
export { accountManager };
