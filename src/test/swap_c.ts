import { logger } from "../sys_lib/logger";
import * as _ from "lodash";
import { EthUnit } from "../utils/eth";
import { evaluate } from "mathjs";

const msgStr = `{
  "@class": "com.bytetrade.obridge.bean.CmdEvent",
  "cmd": "EVENT_LOCK_QUOTE",
  "quote_data": null,
  "quote_remove_info": null,
  "pre_business": {
    "@class": "com.bytetrade.obridge.bean.PreBusiness",
    "swap_asset_information": {
      "@class": "com.bytetrade.obridge.bean.SwapAssetInformation",
      "bridge_name": "9006_9006_0x7a5CEA1c44c27EfE3875e20d8a07F3B1441ba484_0x61d35c6b6a7568542aca42448b47690650c69bb9",
      "lp_id_fake": "dLPcR5JYY0055si",
      "sender": "0x1e1f3324f5482bacea3e07978278624f28e4ca4a",
      "amount": "1000000000000000000000",
      "dst_address": "0x1e1f3324f5482bacea3e07978278624f28e4ca4a",
      "dst_amount": "991020003170000000000",
      "dst_native_amount": "15713390000000000",
      "system_fee_src": 15,
      "system_fee_dst": 15,
      "dst_amount_need": "992508766319479218829",
      "dst_native_amount_need": "15736995493239860",
      "time_lock": 1681280662,
      "quote": {
        "@class": "com.bytetrade.obridge.bean.Quote",
        "quote_base": {
          "@class": "com.bytetrade.obridge.bean.QuoteBase",
          "bridge": {
            "@class": "com.bytetrade.obridge.bean.BridgeInfo",
            "src_chain_id": 9006,
            "dst_chain_id": 9006,
            "src_token": "0x7a5CEA1c44c27EfE3875e20d8a07F3B1441ba484",
            "dst_token": "0x61d35c6b6a7568542aca42448b47690650c69bb9",
            "bridge_name": "9006_9006_0x7a5CEA1c44c27EfE3875e20d8a07F3B1441ba484_0x61d35c6b6a7568542aca42448b47690650c69bb9"
          },
          "lp_bridge_address": "0x0648e55e37FbADa5ADD959243939d7A7b469d72a",
          "price": "0.996",
          "native_token_price": "0.00314268",
          "native_token_max": "0.01571339",
          "native_token_min": "0.00157134",
          "capacity": "0x42207560580000000000000",
          "lp_node_uri": "https://otmoiclp.iopop.snowinning.com/lpnode",
          "quote_hash": "b4a2fc7e846b29d64ca042007aa06a811c098b98"
        },
        "quote_name": "9006_9006_0x7a5CEA1c44c27EfE3875e20d8a07F3B1441ba484_0x61d35c6b6a7568542aca42448b47690650c69bb9_dLPcR5JYY0055si",
        "timestamp": 1681280050049
      },
      "append_information": ""
    },
    "hash": "0xd6b340cfb8a209ad",
    "lp_salt": null,
    "hashlock_evm": null,
    "hashlock_xrp": null,
    "hashlock_near": null,
    "locked": null,
    "timestamp": null,
    "order_append_data": null
  },
  "business_full_data": null,
  "cid": null,
  "amount": null
}`;
const msg = JSON.parse(msgStr);
// logger.debug(msg);

const orgPrice = 1;
const srcFee =
  _.get(msg, "pre_business.swap_asset_information.system_fee_src", 0) / 10000;

const leftInputAmount = EthUnit.fromWei(
  _.get(msg, "pre_business.swap_asset_information.amount", ""),
  18
);
const dstAmount = EthUnit.fromWei(
  _.get(msg, "pre_business.swap_asset_information.dst_amount", ""),
  18
);
const dst_native_amount = EthUnit.fromWei(
  _.get(msg, "pre_business.swap_asset_information.dst_native_amount", ""),
  18
);
logger.debug(leftInputAmount, srcFee, dstAmount);
const bnbPrice = 0.00314268;
logger.debug("目标币价值 N 个 srcToken", (1 / orgPrice) * dstAmount);
logger.debug(
  "目标原生币价值 N 个 srcToken",
  (1 / bnbPrice) * dst_native_amount
);

// orgPrice * leftInputAmount * 0.004 * x = dstAmount /
const luma = `1-${dstAmount}/(${orgPrice}*${leftInputAmount}*(1-0.004))`;
logger.debug(luma);
logger.debug(evaluate(luma));

const bnbluma = `${bnbPrice}*${leftInputAmount}`;
logger.debug(bnbluma);
const maxBnb = evaluate(bnbluma);
logger.debug("全额兑换BNB可换:", maxBnb);
logger.debug("按照比例可以兑换", maxBnb * 0.004999996817269037 * (1 - 0.0));

// x * bnbPrice = 0.01571339
logger.debug(0.01571339 / bnbPrice + 991.02000317);

// logger.debug( / );
