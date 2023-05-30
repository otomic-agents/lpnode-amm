import WebSocket from "ws";
import { logger } from "../../../../sys_lib/logger";
import * as _ from "lodash";
import { portfolioConfig } from "./portfolio_config";
const Emittery = require("emittery");
class PortfolioPrivateStream extends Emittery {
  // @ts-ignore
  private accountId: string;
  private socket: WebSocket.WebSocket;
  private keepAvailable: NodeJS.Timer;
  constructor(accountId: string) {
    super();
    this.accountId = accountId;
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

  public async connect() {
    logger.debug("init streams 💥");
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
  private async reconnect() {
    if (this.socket) {
      try {
        this.clearKeeper();
        this.socket.removeAllListeners();
        this.socket.close();
      } catch (e) {
        logger.error(`close socket error:`, e);
      }
    }
    this.connect();
  }
  private onOpen() {
    this.sign();
    setTimeout(() => {
      this.subscribeOrder();
    }, 300);
    this.sendKeepAvailable();
  }
  private sendKeepAvailable() {
    this.keepAvailable = setInterval(() => {
      logger.debug(`send keepAvailable data`);
      this.socket.send(
        JSON.stringify({ method: "server.ping", params: [], id: 96803098084 })
      );
    }, 1000 * 40);
  }
  private clearKeeper() {
    if (this.keepAvailable) {
      clearInterval(this.keepAvailable);
    }
  }
  private sign() {
    this.socket.send(
      JSON.stringify({
        id: this.messageId(),
        method: "server.sign",
        params: [this.accountId],
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
      const orderEvent = _.get(message, "params.event", "empty");
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
  }
  private onError(err: any) {
    logger.error(`socket error:`, err);
    setTimeout(() => {
      this.reconnect();
    }, 1000);
  }
}
export { PortfolioPrivateStream };
