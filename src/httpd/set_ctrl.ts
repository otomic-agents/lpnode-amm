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

    // eth-usdt
    // eventProcess.onMessage(
    //   JSON.stringify(req.body),
    //   "0x61D35C6B6a7568542acA42448B47690650C69bb9/0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23_9006_9006"
    // );
    // eth - btc;
    eventProcess.onMessage(
      JSON.stringify(req.body),
      "0x61D35C6B6a7568542acA42448B47690650C69bb9/0x91Ea4F2c00De52F595DEC40D9F1B073eA33f8664_9006_9006"
    );
    // ustd-eth
    // eventProcess.onMessage(
    //   JSON.stringify(req.body),
    //   "0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23/0x61D35C6B6a7568542acA42448B47690650C69bb9_9006_9006"
    // );
    // usdt-usdt
    // eventProcess.onMessage(
    //   JSON.stringify(req.body),
    //   "0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23/0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23_9006_9006"
    // );
    // eth - eth;
    // eventProcess.onMessage(
    //   JSON.stringify(req.body),
    //   "0x61D35C6B6a7568542acA42448B47690650C69bb9/0x61D35C6B6a7568542acA42448B47690650C69bb9_9006_9006"
    // );

    // T - USDT;
    // eventProcess.onMessage(
    //   JSON.stringify(req.body),
    //   "0x7a5CEA1c44c27EfE3875e20d8a07F3B1441ba484/0x5b93c8BB3b5E29214FA16cbF062a4FF3cF4fbF23_9006_9006"
    // );

    // eventProcess.onMessage(
    //   JSON.stringify(req.body),
    //   "0x61D35C6B6a7568542acA42448B47690650C69bb9/0xc46adbee202892c5c989d515763a575bce534fa09c8bb4a13bcd7289a516e97b_9006_397"
    // );

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
