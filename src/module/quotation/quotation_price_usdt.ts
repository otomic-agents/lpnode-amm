/* eslint-disable array-callback-return */
/* eslint-disable @typescript-eslint/indent */
/* eslint-disable arrow-parens */
import BigNumber from "bignumber.js";
import { dataConfig } from "../../data_config";
import { logger } from "../../sys_lib/logger";
import { orderbook } from "../orderbook";
import * as _ from "lodash";
import { AmmContext } from "../../interface/context";
import { SystemMath } from "../../utils/system_math";
import { SystemError, SystemErrorDict } from "../system_error";

/**
 * Quote using orderbook
 * @date 2023/5/19 - 11:15:41
 *
 * @class QuotationPrice
 * @typedef {QuotationPrice}
 */
class QuotationPrice {
  public readonly quoteStableCoin = "USDT";
  public getCoinStableCoinOrderBook(
    token: string,
    chainId: number
  ): {
    stdSymbol: string | null;
    bids: number[][];
    asks: number[][];
    timestamp: number;
  } {
    const { symbol: stdCoinSymbol } = dataConfig.getStdCoinSymbolInfoByToken(
      token,
      chainId
    );
    if (!stdCoinSymbol) {
      logger.error(
        SystemError.getErrorMessage(
          SystemErrorDict.baseInfo.stdCoinSymbolNotFount
        )
      );
      return {
        stdSymbol: null,
        bids: [[0, 0]],
        asks: [[0, 0]],
        timestamp: new Date().getTime(),
      };
    }
    const stdSymbol = `${stdCoinSymbol}/USDT`;
    if (stdSymbol === "USDT/USDT" || stdSymbol === "USDC/USDT") {
      return {
        stdSymbol,
        bids: [[1, 100000000]],
        asks: [[1, 100000000]],
        timestamp: new Date().getTime(),
      };
    }
    if (stdSymbol === "T/USDT") {
      return {
        stdSymbol,
        bids: [[1, 100000000]],
        asks: [[1, 100000000]],
        timestamp: new Date().getTime(),
      };
    }
    const orderbookItem = orderbook.getSpotOrderbook(stdSymbol);
    if (!orderbookItem) {
      logger.error(`failed to get orderbook...`);
      return {
        stdSymbol: null,
        bids: [[0, 0]],
        asks: [[0, 0]],
        timestamp: new Date().getTime(),
      };
    }
    const { bids, asks } = orderbookItem;
    const retBids = bids.map((it) => {
      return [Number(it[0]), Number(it[1])];
    });
    const retAsks = asks.map((it) => {
      return [Number(it[0]), Number(it[1])];
    });
    if (retBids.length <= 2 || retAsks.length <= 2) {
      logger.debug(`the depth of the orderbook is not enough`, stdSymbol);
      return {
        stdSymbol: null,
        bids: [[0, 0]],
        asks: [[0, 0]],
        timestamp: new Date().getTime(),
      };
    }
    return {
      stdSymbol,
      asks: retAsks,
      bids: retBids,
      timestamp: orderbookItem.timestamp,
    };
  }
  public getCoinStableCoinOrderBookLiquidity(
    token: string,
    chainId: number
  ): {
    stdSymbol: string | null;
    bids: number;
    asks: number;
    timestamp: number;
  } {
    const { symbol: stdCoinSymbol } = dataConfig.getStdCoinSymbolInfoByToken(
      token,
      chainId
    );
    if (!stdCoinSymbol) {
      logger.error(`wrong token symbol:${token}`);
      return {
        stdSymbol: null,
        bids: 0,
        asks: 0,
        timestamp: new Date().getTime(),
      };
    }
    const stdSymbol = `${stdCoinSymbol}/USDT`;
    if (stdSymbol === "USDT/USDT" || stdSymbol === "USDC/USDT") {
      return {
        stdSymbol,
        bids: 100000000,
        asks: 100000000,
        timestamp: new Date().getTime(),
      };
    }
    if (stdSymbol === "T/USDT") {
      return {
        stdSymbol,
        bids: 100000000,
        asks: 100000000,
        timestamp: new Date().getTime(),
      };
    }
    const orderbookItem = orderbook.getSpotOrderbook(stdSymbol);
    if (!orderbookItem) {
      logger.error(`failed to get orderbook...`);
      return {
        stdSymbol: null,
        bids: 0,
        asks: 0,
        timestamp: new Date().getTime(),
      };
    }
    const { bids, asks } = orderbookItem;
    let bidsNumber = 0;
    let asksNumber = 0;
    bids.map((it) => {
      bidsNumber = bidsNumber + Number(it[1]);
    });
    asks.map((it) => {
      asksNumber = asksNumber + Number(it[1]);
    });
    return {
      stdSymbol,
      asks: asksNumber,
      bids: bidsNumber,
      timestamp: orderbookItem.timestamp,
    };
  }

  public getCoinStableCoinExecuteOrderbook(
    token: string,
    chainId: number,
    amount: number
  ): {
    stdSymbol: string | null;
    bids: number[][];
    asks: number[][];
    timestamp: number;
  } {
    const { symbol: stdCoinSymbol } = dataConfig.getStdCoinSymbolInfoByToken(
      token,
      chainId
    );
    if (!stdCoinSymbol) {
      logger.error(
        `Failed to get the StdCoinSymbol corresponding to Token, please check the basic configuration:${token}`
      );
      return {
        stdSymbol: null,
        bids: [[0, 0]],
        asks: [[0, 0]],
        timestamp: new Date().getTime(),
      };
    }
    const stdSymbol = `${stdCoinSymbol}/USDT`;
    if (stdSymbol === "USDT/USDT" || stdSymbol === "USDC/USDT") {
      return {
        stdSymbol,
        bids: [[1, 100000000]],
        asks: [[1, 100000000]],
        timestamp: new Date().getTime(),
      };
    }
    if (stdSymbol === "T/USDT") {
      return {
        stdSymbol,
        bids: [[1, 100000000]],
        asks: [[1, 100000000]],
        timestamp: new Date().getTime(),
      };
    }
    const orderbookItem = orderbook.getSpotOrderbook(stdSymbol);
    if (!orderbookItem) {
      logger.error(`Failed to get orderbook...`);
      return {
        stdSymbol: null,
        bids: [[0, 0]],
        asks: [[0, 0]],
        timestamp: new Date().getTime(),
      };
    }
    const { bids: orderbook_bids, asks: orderbook_asks } = orderbookItem;
    const level_1_asks = (inputAmount: number): number[][] => {
      const total_amount = inputAmount;
      let left_amount = inputAmount;
      const execResult: any = [];
      orderbook_asks.map((it) => {
        const orderbook_amount = Number(it[1]);
        if (left_amount === 0) {
          return;
        }
        if (orderbook_amount >= left_amount) {
          execResult.push({ price: it[0], executeAmount: left_amount });
          left_amount = left_amount - left_amount;
        } else {
          execResult.push({ price: it[0], executeAmount: orderbook_amount });
          left_amount = left_amount - orderbook_amount;
        }
        //
      });

      let cost = 0;
      execResult.map((it) => {
        cost = SystemMath.execNumber(
          `${cost} +${it.executeAmount} * ${it.price}`,
          "",
          false
        );
      });
      // console.log(execResult, orderbook_asks);
      if (left_amount > 0) {
        throw "orderbook unable to meet the offer";
      }
      return [
        [
          SystemMath.execNumber(`${cost} / ${total_amount}`, "", false),
          inputAmount,
        ],
      ];
    };
    const level_1_bids = (inputAmount: number): number[][] => {
      const total_amount = inputAmount;
      let left_amount = inputAmount;
      const execResult: any = [];
      orderbook_bids.map((it) => {
        const orderbook_amount = Number(it[1]);
        if (left_amount === 0) {
          return;
        }
        if (orderbook_amount >= left_amount) {
          execResult.push({ price: it[0], executeAmount: left_amount });
          left_amount = left_amount - left_amount;
        } else {
          execResult.push({ price: it[0], executeAmount: orderbook_amount });
          left_amount = left_amount - orderbook_amount;
        }
        //
      });

      let cost = 0;
      execResult.map((it) => {
        cost = SystemMath.execNumber(
          `${cost} +${it.executeAmount} * ${it.price}`,
          "",
          false
        );
      });
      // console.log(execResult, orderbook_bids);
      if (left_amount > 0) {
        throw "orderbook unable to meet the offer";
      }
      return [
        [
          SystemMath.execNumber(`${cost} / ${total_amount}`, "", false),
          inputAmount,
        ],
      ];
    };
    return {
      stdSymbol,
      asks: level_1_asks(amount),
      bids: level_1_bids(amount),
      timestamp: orderbookItem.timestamp,
    };
  }

  public getCoinStableCoinOrderBookByCoinName(stdCoinSymbol: string): {
    stdSymbol: string | null;
    bids: number[][];
    asks: number[][];
  } {
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
      logger.error(`failed to get orderbook...${stdSymbol}`);
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

  public getCoinStableCoinOrderBookLiquidityByCoinName(stdCoinSymbol: string): {
    stdSymbol: string | null;
    bids: number;
    asks: number;
    timestamp: number;
  } {
    const stdSymbol = `${stdCoinSymbol}/USDT`;
    if (stdSymbol === "USDT/USDT" || stdCoinSymbol === "USDC/USDC") {
      return {
        stdSymbol: "USDT/USDT",
        bids: 100000000,
        asks: 100000000,
        timestamp: new Date().getTime(),
      };
    }
    const orderbookItem = orderbook.getSpotOrderbook(stdSymbol);
    if (!orderbookItem) {
      logger.error(`failed to get orderbook...${stdSymbol}`);
      return {
        stdSymbol: null,
        bids: 0,
        asks: 0,
        timestamp: new Date().getTime(),
      };
    }
    const { bids, asks } = orderbookItem;
    let bidsNumber = 0;
    let asksNumber = 0;
    bids.map((it) => {
      bidsNumber = bidsNumber + Number(it[1]);
    });
    asks.map((it) => {
      asksNumber = asksNumber + Number(it[1]);
    });
    return {
      stdSymbol,
      asks: asksNumber,
      bids: bidsNumber,
      timestamp: orderbookItem.timestamp,
    };
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
    const gasSymbol = dataConfig.getChainTokenName(chainId);
    if (!gasSymbol) {
      throw new Error(`No coins found for the target chain 【${chainId}】`);
    }
    const {
      asks: [[tokenUsdtPrice]],
    } = this.getCoinStableCoinOrderBookByCoinName(gasSymbol);
    if (!_.isFinite(tokenUsdtPrice) || tokenUsdtPrice === 0) {
      logger.error(`failed to get price :${gasSymbol}`);
      throw new Error(`failed to get price :${gasSymbol}`);
    }
    return tokenUsdtPrice;
  }
  public getNativeTokenBuyLiquidity(chainId: number): number {
    const gasSymbol = dataConfig.getChainTokenName(chainId);
    if (!gasSymbol) {
      throw new Error(`No coins found for the target chain 【${chainId}】`);
    }
    const { asks: askLiquidity } =
      this.getCoinStableCoinOrderBookLiquidityByCoinName(gasSymbol);
    if (!_.isFinite(askLiquidity) || askLiquidity === 0) {
      logger.error(`no liquidity information found ${gasSymbol}`);
      throw new Error(
        `DstChainNativeToken/USDT no liquidity information found`
      );
    }
    return askLiquidity;
  }

  public getSrcTokenBuyPrice(ammContext: AmmContext) {
    const { stdSymbol, asks } = this.getCoinStableCoinOrderBook(
      ammContext.baseInfo.srcToken.address,
      ammContext.baseInfo.srcToken.chainId
    );
    if (stdSymbol === null) {
      throw new Error(
        `no orderbook found,bridge ${ammContext.bridgeItem.msmq_name} bridgeInfo ${ammContext.summary}`
      );
    }
    const [[price]] = asks;
    return price;
  }
  public getGasTokenBuyPrice(ammContext: AmmContext) {
    const { stdSymbol, asks } = this.getCoinStableCoinOrderBookByCoinName(
      ammContext.baseInfo.dstChain.tokenName
    );
    if (stdSymbol === null) {
      throw new Error(
        `no orderbook found, chain ${ammContext.baseInfo.dstChain.id}`
      );
    }
    const [[price]] = asks;
    return price;
  }

  public getDstTokenBuyPrice(ammContext: AmmContext) {
    const { stdSymbol, asks } = this.getCoinStableCoinOrderBook(
      ammContext.baseInfo.dstToken.address,
      ammContext.baseInfo.dstToken.chainId
    );
    if (stdSymbol === null) {
      throw new Error(
        `no orderbook found,bridge ${ammContext.bridgeItem.msmq_name}`
      );
    }
    const [[price]] = asks;
    return price;
  }

  public getDstTokenSellPrice(ammContext: AmmContext) {
    const { stdSymbol, bids } = this.getCoinStableCoinOrderBook(
      ammContext.baseInfo.dstToken.address,
      ammContext.baseInfo.dstToken.chainId
    );
    if (stdSymbol === null) {
      throw new Error(
        `no orderbook found,bridge ${ammContext.bridgeItem.msmq_name}`
      );
    }
    const [[price]] = bids;
    return price;
  }
}

const quotationPrice: QuotationPrice = new QuotationPrice();
export { QuotationPrice, quotationPrice };
