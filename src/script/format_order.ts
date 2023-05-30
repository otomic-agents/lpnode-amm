const fs = require("fs");
const path = require("path");
const envFile = fs.existsSync(path.join(__dirname, "../", "env.js"));
if (envFile) {
  require("../env.js");
} else {
  console.log("env File 不存在");
}
// import BigNumber from "bignumber.js";
import { appEnv } from "../app_env"; // 这个要在最前边
appEnv.initConfig(); // 初始化基本配置
import { dataConfig } from "../data_config";
import { accountManager } from "../module/exchange/account_manager";
import { logger } from "../sys_lib/logger";
import { formatStepSize } from "../module/exchange/utils";
import * as _ from "lodash";
import { ICexAccountApiType } from "../interface/std_difi";

console.log(formatStepSize("0.013884994", "0.01000000"));

async function main() {
  await dataConfig.prepareConfigResource(); // 提前创建配置
  // await accountManager.init();
  await accountManager.loadAccounts([
    {
      apiType: ICexAccountApiType.portfolio,
      accountId: "a001",
      exchangeName: "binance",
    },
  ]);
  setTimeout(async () => {
    const result = accountManager.getAccount("a001")?.order.testSpotFormat({
      settle_size: 0.0,
      exchange: 2,
      account_name: "binance_spot_bt_demo_trader",
      event: "ORDER_DONE",
      iv: 0.0,
      base: "",
      client_id: "AFUDZkprra0N6bc4DcD8C9",
      order_id: "13509383349",
      status: 5,
      client_id_from_ex: "",
      is_create_order_by_iv: false,
      settle: "",
      size_filled: 0.0070000000000000001,
      market: "ETHUSDT",
      order_type: "market",
      quote_size: 0.0,
      price: 0.0,
      side: "sell",
      quote: "",
      quote_size_filled: 12.645290000000001,
      size: 0.0070000000000000001,
      timestamp: 1685081917.6995289,
    });
    logger.debug(result);
  }, 3000);
}

main()
  .then(() => {
    //
  })
  .catch((e: any) => {
    logger.error("e");
  });
