import { eventProcess } from "../event_process";
import { dataRedis } from "../redis_bus";

class SetCtrl {
  public async setTokenToSymbol(req: any, res: any) {
    const key = "LP:CONFIG:token_to_symbol";
    dataRedis.set(key, JSON.stringify(req.body));
    res.end();
    //
  }
  public async setHedgeConfig(req: any, res: any) {
    const key = "LP:CONFIG:hedge_config";
    dataRedis.set(key, JSON.stringify(req.body));
    res.end();
  }
  public async setChainName(req: any, res: any) {
    const key = "LP:CONFIG:chain_name";
    dataRedis.set(key, JSON.stringify(req.body));
    res.end();
  }
  public async eventTest(req: any, res: any) {
    // "bridge-B-C" ETH/USDT
    // "bridge-B-A" ETH/AVAX
    // bs 这里的最大量还没有测试 ETH/USDT

    eventProcess.onMessage(
      JSON.stringify(req.body),
      "0x61D35C6B6a7568542acA42448B47690650C69bb9/0xc46adbee202892c5c989d515763a575bce534fa09c8bb4a13bcd7289a516e97b_9006_397"
    );

    // eventProcess.onMessage(
    //   JSON.stringify(req.body),
    //   "0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23/0x61D35C6B6a7568542acA42448B47690650C69bb9"
    // );
    // eventProcess.onMessage(
    //   JSON.stringify(req.body),
    //   "0x61D35C6B6a7568542acA42448B47690650C69bb9/0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23"
    // );

    // ss
    // eventProcess.onMessage(JSON.stringify(req.body), "bridge-B-C");

    // bb ETH/AVAX
    // eventProcess.onMessage(JSON.stringify(req.body), "bridge-B-A");
    res.end();
  }
}
const setCtrl: SetCtrl = new SetCtrl();
export { SetCtrl, setCtrl };