/* eslint-disable @typescript-eslint/indent */
/* eslint-disable arrow-parens */
import BigNumber from "bignumber.js";
import { dataConfig } from "../../data_config";
import { logger } from "../../sys_lib/logger";
import { orderbook } from "../orderbook";
import * as _ from "lodash";
import { AmmContext } from "../../interface/context";

class QuotationPrice {
  public getCoinUsdtOrderbook(
    token: string,
    chainId: number
  ): {
    stdSymbol: string | null;
    bids: number[][];
    asks: number[][];
  } {
    const { symbol: stdCoinSymbol } = dataConfig.getStdCoinSymbolInfoByToken(
      token,
      chainId
    );
    if (!stdCoinSymbol) {
      logger.error(`获取Token对应的StdCoinSymbol失败，请检查基础配置${token}`);
      return { stdSymbol: null, bids: [[0, 0]], asks: [[0, 0]] };
    }
    const stdSymbol = `${stdCoinSymbol}/USDT`;
    if (stdSymbol === "USDT/USDT" || stdSymbol === "USDC/USDT") {
      return {
        stdSymbol,
        bids: [[1, 100000000]],
        asks: [[1, 100000000]],
      };
    }
    if (stdSymbol === "T/USDT") {
      return {
        stdSymbol,
        bids: [[1, 100000000]],
        asks: [[1, 100000000]]
      };
    }
    const orderbookItem = orderbook.getSpotOrderbook(stdSymbol);
    if (!orderbookItem) {
      logger.error(`获取orderbook失败...`);
      return { stdSymbol: null, bids: [[0, 0]], asks: [[0, 0]] };
    }
    const { bids, asks } = orderbookItem;
    const retBids = bids.map((it) => {
      return [Number(it[0]), Number(it[1])];
    });
    const retAsks = asks.map((it) => {
      return [Number(it[0]), Number(it[1])];
    });
    if (retBids.length <= 2 || retAsks.length <= 2) {
      logger.debug(`orderbook的深度不够`, stdSymbol);
      return { stdSymbol: null, bids: [[0, 0]], asks: [[0, 0]] };
    }
    return { stdSymbol, asks: retAsks, bids: retBids };
  }

  public getCoinUsdtOrderbookByCoinName(stdCoinSymbol: string): { stdSymbol: string | null, bids: number[][], asks: number[][] } {
    const stdSymbol = `${stdCoinSymbol}/USDT`;
    if (stdSymbol === "USDT/USDT") {
      return {
        stdSymbol: "USDT/USDT",
        bids: [[1, 100000000]],
        asks: [[1, 100000000]],
      };
    }
    const orderbookItem = orderbook.getSpotOrderbook(stdSymbol);
    if (!orderbookItem) {
      logger.error(`获取orderbook失败...${stdSymbol}`);
      return { stdSymbol: null, bids: [[0, 0]], asks: [[0, 0]] };
    }
    const { bids, asks } = orderbookItem;
    const retBids = bids.map((it) => {
      return [Number(it[0]), Number(it[1])];
    });
    const retAsks = asks.map((it) => {
      return [Number(it[0]), Number(it[1])];
    });
    return { stdSymbol, asks: retAsks, bids: retBids };
  }

  public getABPrice(
    amount: BigNumber,
    A: { bids: any; asks: any } | any,
    B: { bids: any; asks: any } | any
  ) {
    // ETH-AVAX
    const { bids: ABids } = A;
    const [[aPrice]] = ABids;
    const { asks: BAsks } = B;
    const [[bPrice]] = BAsks;
    const bnA = new BigNumber(aPrice);
    const bnB = new BigNumber(bPrice);
    return bnA.div(bnB);
  }

  public getNativeTokenBidPrice(chainId: number) {
    const gasSymbol = dataConfig.getChainTokenName(
      chainId,
    );
    if (!gasSymbol) {
      throw new Error(`No coins found for the target chain 【${chainId}】`);
    }
    const {
      asks: [[tokenUsdtPrice]],
    } = this.getCoinUsdtOrderbookByCoinName(gasSymbol);
    if (!_.isFinite(tokenUsdtPrice) || tokenUsdtPrice === 0) {
      logger.error(`没有找到U价，报价失败 ${gasSymbol}`);
      throw new Error(
        `目标链Gas币Usdt 价值获取失败，无法报价${gasSymbol}`,
      );
    }
    return tokenUsdtPrice;
  }

  public getSrcTokenBidPrice(ammContext: AmmContext) {
    const {
      stdSymbol,
      asks,
    } = this.getCoinUsdtOrderbook(ammContext.baseInfo.srcToken.address, ammContext.baseInfo.srcToken.chainId);
    if (stdSymbol === null) {
      throw new Error(`no orderbook found,bridge ${ammContext.bridgeItem.msmq_name}`);
    }
    const [[price]] = asks;
    return price;
  }
}

const quotationPrice: QuotationPrice = new QuotationPrice();
export { QuotationPrice, quotationPrice };
