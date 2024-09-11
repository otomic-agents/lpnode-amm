import bs58 from "bs58";
import { logger } from "../sys_lib/logger";
const Web3 = require("web3");
const web3 = new Web3();
class ChainAdapter {
  public AddressAdapter_397(address: string) {
    logger.info("AddressAdapter_397", address);
    const bytes = bs58.decode(address);
    return `0x${Buffer.from(bytes)
      .toString("hex")}`;
  }
  public AddressAdapter_501(address:string){
    logger.info("AddressAdapter_501", address);
    const bytes = bs58.decode(address);
    return `0x${Buffer.from(bytes)
      .toString("hex")}`;
  }
  public AddressToUniq_0(address:string){
    return web3.utils.hexToNumberString(address);
  }
  public AddressToUniq_397(address:string){
    const bytes = bs58.decode(address);
    const ud = web3.utils.hexToNumberString(
      `0x${Buffer.from(bytes).toString("hex")}`
    );
    return ud;
  }
  public AddressToUniq_501(address:string){
    const bytes = bs58.decode(address);
    const ud = web3.utils.hexToNumberString(
      `0x${Buffer.from(bytes).toString("hex")}`
    );
    return ud;
  }
}

const chainAdapter: ChainAdapter = new ChainAdapter();

export {
  chainAdapter
};

