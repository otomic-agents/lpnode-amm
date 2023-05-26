import { logger } from "../../sys_lib/logger";

class AsyncOrderMonitor {
  public constructor() {
    logger.info(`init AsyncOrderMonitor`);
  }
  onOrder(orderData: any) {
    console.log("________________");
    logger.info(`order data`, orderData);
    console.log("________________");
  }
}
export { AsyncOrderMonitor };
