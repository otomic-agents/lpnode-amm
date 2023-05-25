import { logger } from "../../../../sys_lib/logger";

class PortfolioAuthManager {
  // @ts-ignore
  private accountId: string;
  constructor(accountId: string, userInfo: any) {
    logger.debug(`init PortfolioAuthManager 🪱`);
    this.accountId = accountId;
  }
  public async init() {
    //
  }
}
export { PortfolioAuthManager };
