import { IBridgeTokenConfigItem } from "./interface/interface";
import { FeeManager } from "./module/bridge_extend/fee_manager";
import { StatusManager } from "./module/bridge_extend/status_manager";

function extend_bridge_item(source_object: any, context: any): IBridgeTokenConfigItem {
  return new Proxy(source_object, {
    get(target_object, key, receiver): any {
      if (key === "std_symbol") {
        const uniqAddress0 = context.convertAddressToUniq(target_object.srcToken, target_object.src_chain_id);
        const uniqAddress1 = context.convertAddressToUniq(target_object.dstToken, target_object.dst_chain_id);
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
        return new FeeManager(target_object);
      }
      if (key === "status_manager") {
        return new StatusManager(target_object);
      }
      return Reflect.get(target_object, key, receiver);
    }
  });
}

export {
  extend_bridge_item
};
