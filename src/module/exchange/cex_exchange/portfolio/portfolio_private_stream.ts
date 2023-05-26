import WebSocket from "ws";
import { logger } from "../../../../sys_lib/logger";
import * as _ from "lodash";
import { portfolioConfig } from "./portfolio_config";
const Emittery = require("emittery");
class PortfolioPrivateStream extends Emittery {
  // @ts-ignore
  private accountId: string;
  private socket: WebSocket.WebSocket;
  constructor(accountId: string) {
    super();
    this.accountId = accountId;
    this.init();
  }
  private id = 1;
  private messageId(): number {
    if (this.id > 65535 * 10000) {
      this.id = 1;
      return this.id;
    }
    this.id = this.id + 1;
    return this.id;
  }
  public init() {
    logger.debug("init streams 💥💥💥💥💥");
    const ws = new WebSocket(portfolioConfig.getBaseApi("wsOrderStream"));
    this.socket = ws;
    ws.on("error", (err: any) => {
      this.onError(err);
    });
    ws.on("message", (data: any) => {
      this.onMessage(data);
    });
    ws.on("open", () => {
      this.onOpen();
    });
  }
  private onOpen() {
    this.sign();
    this.subscribeOrder();
  }
  private sign() {
    this.socket.send(
      JSON.stringify({
        id: this.messageId(),
        method: "server.sign",
        params: ["binance_spot_bt_demo_trader"],
      })
    );
  }
  private subscribeOrder() {
    this.socket.send(
      JSON.stringify({
        id: this.messageId(),
        method: "order.subscribe2",
        params: [],
      })
    );
  }
  private onMessage(data: NodeJS.ArrayBufferView) {
    try {
      const message = JSON.parse(data.toString());
      const method = _.get(message, "method", "");
      const orderStatus = _.get(message, "params.status", 0);
      const orderEvent = _.get(message, "params.event", "Empty");
      if (method === "") {
        logger.error("method is empty");
        return;
      }
      if (
        method === "order.update" &&
        orderStatus === 5 &&
        orderEvent === "ORDER_DONE"
      ) {
        this.emit("streamEvent", {
          action: "order_result",
          payload: {
            market: "spot",
            rawInfo: _.get(message, "params", {}),
          },
        });
      }
    } catch (e) {
      logger.error(`parse message string error:`, e);
    }

    // logger.debug(`received message 💦`, data.toString());
  }
  private onError(err: any) {
    logger.error(`socket error:`, err);
  }
}
export { PortfolioPrivateStream };
