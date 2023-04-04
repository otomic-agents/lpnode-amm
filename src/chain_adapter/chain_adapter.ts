import bs58 from "bs58";
import { logger } from "../sys_lib/logger";

class ChainAdapter {
  public AddressAdapter_397(address: string) {
    logger.info("AddressAdapter_397", address);
    const bytes = bs58.decode(address);
    return `0x${Buffer.from(bytes)
      .toString("hex")}`;
  }

}

const chainAdapter: ChainAdapter = new ChainAdapter();

export {
  chainAdapter
};

