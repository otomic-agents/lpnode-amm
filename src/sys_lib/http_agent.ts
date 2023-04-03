/**
 * 用于维持KeepLive的agent
 */
const http = require("http");
const https = require("https");
const httpKeepAliveAgent = new http.Agent({
  keepAlive: true,
  maxTotalSockets: 300,
  keepAliveMsecs: 1000 * 120,
  maxFreeSockets: 100,
});
import * as _ from "lodash";
// import { logger } from "./logger";

const httpCreateFun = http.Agent.prototype.createSocket;
if (typeof httpCreateFun === "function") {
  http.Agent.prototype.createSocket = function() {
    // eslint-disable-next-line prefer-rest-params
    // logger.debug(
    //   "HTTP CreateSocket",
    //   // eslint-disable-next-line prefer-rest-params
    //   _.get(arguments, "1.hostname", ""),
    //   // eslint-disable-next-line prefer-rest-params
    //   _.get(arguments, "1.port", "")
    // );
    // eslint-disable-next-line prefer-rest-params
    httpCreateFun.apply(this, arguments);
  };
}

const httpsCreateFun = https.Agent.prototype.createSocket;
if (typeof httpsCreateFun === "function") {
  https.Agent.prototype.createSocket = function() {
    // eslint-disable-next-line prefer-rest-params
    // logger.debug(
    //   "HTTPS CreateSocket",
    //   // eslint-disable-next-line prefer-rest-params
    //   _.get(arguments, "1.hostname", ""),
    //   // eslint-disable-next-line prefer-rest-params
    //   _.get(arguments, "1.port", "")
    // );
    // eslint-disable-next-line prefer-rest-params
    httpsCreateFun.apply(this, arguments);
  };
}

const httpsKeepAliveAgent = new https.Agent({
  keepAlive: true,
  maxTotalSockets: 300,
  keepAliveMsecs: 1000 * 60,
  maxFreeSockets: 100,
  // rejectUnauthorized:false
});
const httpsKeepAliveAgentWithOutSSLValidation = new https.Agent({
  keepAlive: true,
  maxTotalSockets: 300,
  keepAliveMsecs: 1000 * 60,
  maxFreeSockets: 100,
  rejectUnauthorized: false,
});
const globalWeb3AgentConfig = {
  agent: {
    http: httpKeepAliveAgent,
    https: httpsKeepAliveAgent,
    httpsNotSsl: httpsKeepAliveAgentWithOutSSLValidation,
  },
};
export {
  httpKeepAliveAgent,
  httpsKeepAliveAgent,
  globalWeb3AgentConfig,
  httpsKeepAliveAgentWithOutSSLValidation as httpsKeepAliveAgentNotSsl,
};
