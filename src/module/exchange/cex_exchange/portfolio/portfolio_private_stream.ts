import WebSocket from "ws";
import { logger } from "../../../../sys_lib/logger";
import * as _ from "lodash";
import { portfolioRequestManager } from "./request/portfolio_request";
const Emittery = require("emittery");
class PortfolioPrivateStream extends Emittery {
  // @ts-ignore
  private accountId: string;
  private socket: WebSocket.WebSocket;
  private keepAvailable: NodeJS.Timer;
  private keepSendPromiseList: Map<number, any> = new Map();
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
    const ws = new WebSocket(
      `ws://${portfolioRequestManager.getService()}/legacy/v1alpha1/websocket.portfolio/v1/ws/`
    );
    this.socket = ws;
    ws.on("error", (err: any) => {
      logger.error("stream error");
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
    logger.debug("ws connect open");
    this.sign();
    setTimeout(() => {
      this.subscribeOrder();
    }, 300);
    this.sendKeepAvailable();
  }
  private onPong(msgId: number) {
    const waitContext = this.keepSendPromiseList.get(msgId);
    if (waitContext && typeof waitContext.resolve === "function") {
      waitContext.resolve(msgId);
      return;
    }
    logger.warn(`send context not found msgId:${msgId}`);
  }
  private sendKeepAvailable() {
    this.keepAvailable = setInterval(async () => {
      logger.debug(`send keepAvailable data`);
      try {
        await this.syncSendKeep();
      } catch (e) {
        setTimeout(() => {
          this.reconnect();
        }, 1000);

        logger.error(`keepAvailable data response error`);
      }
    }, 1000 * 10);
  }
  private syncSendKeep() {
    const messageId = this.messageId();
    this.socket.send(
      JSON.stringify({
        method: "server.ping",
        params: [],
        id: messageId,
      })
    );
    return new Promise((resolve, reject) => {
      const clearTimer = (msgId: number) => {
        // logger.debug(`clear timeout..`);
        if (
          this.keepSendPromiseList.get(msgId) &&
          this.keepSendPromiseList.get(msgId)["time"]
        ) {
          clearTimeout(this.keepSendPromiseList.get(msgId)["time"]);
        }
      };
      this.keepSendPromiseList.set(messageId, {
        time: setTimeout(() => {
          reject(new Error("Timeout"));
          this.keepSendPromiseList.delete(messageId);
        }, 3000),
        resolve: (msgId: number) => {
          resolve(true);
          clearTimer(msgId);
          this.keepSendPromiseList.delete(msgId);
        },
        reject: (msgId: number, message: string) => {
          reject(new Error(message));
          clearTimer(msgId);
          this.keepSendPromiseList.delete(msgId);
        },
      });
    });
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
      // logger.debug(`received message`, JSON.stringify(message));
      const method = _.get(message, "method", "");
      const messageId = _.get(message, "id", 0);
      const result = _.get(message, "result", "");
      const orderStatus = _.get(message, "params.status", 0);
      const orderEvent = _.get(message, "params.event", "empty");

      if (messageId > 0 && result === "pong") {
        // logger.info("received a poll message", data.toString());
        this.onPong(messageId);
        return;
      }
      if (method === "") {
        // logger.error("method is empty");
        return;
      }
      if (
        method === "order.update" &&
        orderStatus === 5 &&
        orderEvent === "ORDER_DONE"
      ) {
        const sendPayload = {
          action: "order_result",
          payload: {
            market: "spot",
            rawInfo: _.get(message, "params", {}),
          },
        };
        _.set(sendPayload, "payload.rawInfo.orderEventStatus", "ORDER_DONE");
        this.emit("streamEvent", sendPayload);
      }
      if (
        method === "order.update" &&
        orderStatus === 3 &&
        orderEvent === "ORDER_CREATE_REJECTED"
      ) {
        const sendPayload = {
          action: "order_result",
          payload: {
            market: "spot",
            rawInfo: _.get(message, "params", {}),
          },
        };
        _.set(
          sendPayload,
          "payload.rawInfo.orderEventStatus",
          "ORDER_CREATE_REJECTED"
        );
        this.emit("streamEvent", sendPayload);
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
