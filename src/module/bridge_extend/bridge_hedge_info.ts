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
  public getHedgeIns(): IHedgeClass {
    const ins = hedgeManager.getHedgeIns(dataConfig.getHedgeConfig().hedgeType);
    if (!ins) {
      throw `No hedging implementation found`;
    }
    return ins;
  }
  public getHedgeType(): IHedgeType {
    return dataConfig.getHedgeConfig().hedgeType;
  }
  public getHedgeAccount(): string {
    return dataConfig.getHedgeConfig().hedgeAccount;
  }
  public getAccountIns(): StdAccount {
    const accountIns = accountManager.getAccount(
      dataConfig.getHedgeConfig().hedgeAccount
    );
    if (!accountIns) {
      throw `The loaded hedging account was not found`;
    }
    return accountIns;
  }
}
export { BridgeHedgeInfo };
