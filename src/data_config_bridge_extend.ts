import { IBridgeTokenConfigItem } from "./interface/interface";
import { FeeManager } from "./module/bridge_extend/fee_manager";
import { StatusManager } from "./module/bridge_extend/status_manager";
import { LpWalletManager } from "./module/bridge_extend/lp_wallet_manager";
import * as _ from "lodash";
import { SymbolManager } from "./module/bridge_extend/symbol_manager";

function extend_bridge_item(
  source_object: any,
  context: any
): IBridgeTokenConfigItem {
  const handle = {};
  const proxy = new Proxy(source_object, handle);

  handle["get"] = function get(target_object, key, receiver): any {
    if (key === "std_symbol") {
      const uniqAddress0 = context.convertAddressToUniq(
        target_object.srcToken,
        target_object.src_chain_id
      );
      const uniqAddress1 = context.convertAddressToUniq(
        target_object.dstToken,
        target_object.dst_chain_id
      );
      const key0 = `${target_object.src_chain_id}_${uniqAddress0}`;
      const key1 = `${target_object.dst_chain_id}_${uniqAddress1}`;
      const token0 = context.tokenToSymbolMap.get(key0);
      const token1 = context.tokenToSymbolMap.get(key1);
      if (!token0 || !token1) {
        return "";
      }
      return `${token0.symbol}/${token1.symbol}`;
    }
    if (key === "fee_manager") {
      if (!_.get(target_object, "fee_manager____", undefined)) {
        const feeManager = new FeeManager(proxy);
        _.set(target_object, "fee_manager____", feeManager);
      }
      return _.get(target_object, "fee_manager____", {});
    }
    if (key === "status_manager") {
      if (!_.get(target_object, "status_manager____", undefined)) {
        const statusManager = new StatusManager(proxy);
        _.set(target_object, "status_manager____", statusManager);
        return statusManager;
      }
      return _.get(target_object, "status_manager____", {});
    }
    if (key === "lp_wallet_info") {
      if (!_.get(target_object, "lp_wallet_info____", undefined)) {
        const lpWalletManager = new LpWalletManager(proxy);
        _.set(target_object, "lp_wallet_info____", lpWalletManager);
        return lpWalletManager;
      }
      return _.get(target_object, "lp_wallet_info____", {});
    }
    if (key === "symbol_info") {
      if (!_.get(target_object, "symbol_info____", undefined)) {
        const symbolManager = new SymbolManager(proxy);
        _.set(target_object, "symbol_info____", symbolManager);
        return symbolManager;
      }
      return _.get(target_object, "symbol_info____", {});
    }
    return Reflect.get(target_object, key, receiver);
  };
  return proxy;
}

export { extend_bridge_item };
