import { dataConfig } from "../../data_config";
import {
  IBridgeTokenConfigItem,
  IHedgeClass,
  IHedgeType,
} from "../../interface/interface";
import { StdAccount } from "../exchange/account";
import { accountManager } from "../exchange/account_manager";
import { hedgeManager } from "../hedge_manager";

class BridgeHedgeInfo {
  // @ts-ignore
  private bridgeItem: IBridgeTokenConfigItem;

  constructor(item: IBridgeTokenConfigItem) {
    this.bridgeItem = item;
  }
  public async getHedgeIns(): Promise<IHedgeClass> {
    const ins = hedgeManager.getHedgeIns((await dataConfig.getHedgeConfig()).hedgeType);
    if (!ins) {
      throw `No hedging implementation found`;
    }
    return ins;
  }
  public async isEnable(): Promise<boolean> {
    const enable = await dataConfig.isHedgeEnable(this.bridgeItem.id.toString());
    const bridgeId = this.bridgeItem.id.toString();
    const statusText = enable ? "ENABLED" : "DISABLED";
    console.log(`   📌 HEDGE STATUS: ${statusText}`);
    return enable;
  }
  public async getHedgeType(): Promise<IHedgeType> {
    return (await dataConfig.getHedgeConfig()).hedgeType;
  }
  public async getHedgeAccount(): Promise<string> {
    return (await dataConfig.getHedgeConfig()).hedgeAccount;
  }
  public async getAccountIns(): Promise<StdAccount> {
    const accountIns = accountManager.getAccount(
      (await dataConfig.getHedgeConfig()).hedgeAccount
    );
    if (!accountIns) {
      throw `The loaded hedging account was not found`;
    }
    return accountIns;
  }
}
export { BridgeHedgeInfo };
