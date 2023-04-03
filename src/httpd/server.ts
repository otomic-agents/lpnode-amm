import { logger } from "../sys_lib/logger";
import { setCtrl } from "./set_ctrl";

const express = require("express");
const app = express();
import * as _ from "lodash";
let port = 18081;
if (!_.get(process.env, "production", undefined)) {
  port = 18083;
}
app.use(express.json());
app.post("/setTokenToSymbol", (req, res) => {
  setCtrl.setTokenToSymbol(req, res);
});
app.post("/setHedgeConfig", (req, res) => {
  setCtrl.setHedgeConfig(req, res);
});
app.post("/setChainName", (req, res) => {
  setCtrl.setChainName(req, res);
});
app.post("/eventTest", (req, res) => {
  setCtrl.eventTest(req, res);
});

class HttpServer {
  public start() {
    app.listen(port, () => {
      logger.info(`service ready ${port}`);
    });
  }
}
const httpServer: HttpServer = new HttpServer();
export { httpServer, HttpServer };
