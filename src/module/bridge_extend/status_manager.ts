import { IBridgeTokenConfigItem } from "../../interface/interface";

class StatusManager {
  // @ts-ignore
  private bridgeItem: IBridgeTokenConfigItem;

  constructor(item: IBridgeTokenConfigItem) {
    this.bridgeItem = item;

  }
}

export {
  StatusManager,
};
