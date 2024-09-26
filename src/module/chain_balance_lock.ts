import { chainBalanceLockModule } from "../mongo_module/chain_balance_lock";
import { chainBalance } from "./chain_balance";
import { dataConfig } from "../data_config";
import { logger } from "../sys_lib/logger";
class ChainBalanceLock {
  public constructor() {
    this.scheduledBalanceLockMaintenance();
  }
  public async scheduledBalanceLockMaintenance() {
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        await this.updateLockedStatus();
      } catch (e) {
        logger.error("Error updating locked status:", e);
      }
    }
  }

  public async updateLockedStatus(): Promise<void> {
    const currentTime = Date.now();
    try {
      const result = await chainBalanceLockModule.updateMany(
        {
          locked: true,
          $expr: {
            $gt: [
              currentTime,
              {
                $add: [
                  "$lockedTime",
                  { $multiply: ["$stepTimeLock", 2, 1000] },
                ],
              },
            ],
          },
        },
        {
          $set: { locked: false, isTimeout: true },
        }
      );
    } catch (err) {
      console.error("Error updating locked status:", err);
    }
  }
  public async updateAndUnLock(
    qotationHash: string,
    chainId: number,
    walletName: string,
    tokenId: string,
    nativeTokenId: string,
    amount: number,
    nativeAmount: number,
    stepTimeLock: number
  ): Promise<void> {
    try {
      await chainBalance.updateBalanceSync();
      await chainBalanceLockModule.updateOne(
        {
          walletName: walletName,
          qotationHash: qotationHash,
          tokenId: tokenId.toString(),
        },
        {
          $set: {
            stepTimeLock: stepTimeLock,
            amount: amount,
            locked: true,
            isTimeout: false,
          },
        },
        {
          upsert: true,
        }
      );
      await chainBalanceLockModule.updateOne(
        {
          walletName: walletName,
          qotationHash: qotationHash,
          tokenId: nativeTokenId.toString(),
        },
        {
          $set: {
            stepTimeLock: stepTimeLock,
            amount: nativeAmount,
            locked: true,
            isTimeout: false,
          },
        },
        {
          upsert: true,
        }
      );
    } catch (e) {
      if (e instanceof Error) {
        logger.error(e.message);
      } else {
        logger.error("An unknown error occurred");
      }
    }
  }
  public async freeBalance(qotationHash: string): Promise<void> {
    await chainBalanceLockModule.updateMany(
      {
        qotationHash: qotationHash,
      },
      {
        $set: {
          locked: false,
        },
      }
    );
  }
  public async lock(chainId: number, tokenAddress: string): Promise<boolean> {
    return true;
  }
}
const chainBalanceLock: ChainBalanceLock = new ChainBalanceLock();
export { chainBalanceLock };
