const fs = require("fs");
const path = require("path");
const envFile = fs.existsSync(path.join(__dirname, "../", "env.js"));
if (envFile) {
  require("../env.js");
} else {
  console.log("env file does not exist");
}
import { appEnv } from "../app_env";
appEnv.initConfig();
import { dataConfig } from "../data_config";
import { ICexAccountApiType } from "../interface/std_difi";
import { accountManager } from "../module/exchange/account_manager";
import { logger } from "../sys_lib/logger";
appEnv.initConfig();
async function main() {
  await dataConfig.prepareConfigResource();
  await accountManager.loadAccounts([
    {
      apiType: ICexAccountApiType.exchange,
      accountId: "a003",
      exchangeName: "binance",
      spotAccount: {
        apiKey:
          "VWZhndFZ8Hm4pXvhxk2F5cr9cAgvWcACIpXtNUMSwiKAv8UMBGS2c0i3ObAoslqT",
        apiSecret:
          "6K4y9FcpPdWOb3MSsULe68NqpzJBs2Q2wyHcBNY61D2KiadjrBE0mR7IQer1RvGM",
      },
      usdtFutureAccount: {
        apiKey: "",
        apiSecret: "",
      },
      coinFutureAccount: {
        apiKey: "",
        apiSecret: "",
      },
    },
  ]);
  setTimeout(() => {
    console.log(accountManager.getAccount("a003")?.balance.getAllSpotBalance());
  }, 5000);
}

main()
  .then(() => {
    //
  })
  .catch((e: any) => {
    logger.error("e");
  });
