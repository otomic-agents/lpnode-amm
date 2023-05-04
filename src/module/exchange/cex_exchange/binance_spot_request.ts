import axios from "axios";
import { httpsKeepAliveAgent } from "../../../sys_lib/http_agent";
import { signatureObject } from "../utils";
import { logger } from "../../../sys_lib/logger";
import * as _ from "lodash";
class BinanceSpotRequest {
  public async get(
    url: string,
    data: any,
    apiKey: string | undefined,
    apiSecret: string | undefined
  ) {
    let signedStr = "";
    try {
      const requestOpt: any = {
        url: `${url}`,
        method: "get",
        headers: {},
      };
      if (apiKey && apiSecret) {
        Object.assign(requestOpt.headers, {
          "X-MBX-APIKEY": apiKey,
        });
        signedStr = signatureObject(data, apiSecret);
        requestOpt.url = requestOpt.url + `?${signedStr}`;
      }
      const result = await axios.request(requestOpt);

      if (_.get(result, "status", 0) !== 200) {
        throw new Error("status code neq 200");
      }
      return result;
    } catch (e) {
      const errMsg: any = _.get(e, "response.data.msg", "");
      if (errMsg !== "") {
        logger.error(`${url} request error`, errMsg);
        throw new Error(errMsg.toString());
      }
      logger.error(`${url} request error`, _.get(e, "message", ""));
      throw new Error(_.get(e, "message", ""));
    }
  }
  public async post(url: string, data: any, apiKey: string, apiSecret: string) {
    try {
      const requestOpt: any = {
        url,
        httpsAgent: httpsKeepAliveAgent,
        method: "POST",
        headers: {},
        data: JSON.stringify(data),
      };
      if (apiKey && apiSecret) {
        const postStr = signatureObject(data, apiSecret);
        requestOpt.data = postStr;
        Object.assign(requestOpt.headers, {
          "X-MBX-APIKEY": apiKey,
        });
      }
      const result = await axios.request(requestOpt);
      return result;
    } catch (e) {
      const errMsg: any = _.get(e, "response.data.msg", "");
      if (errMsg !== "") {
        logger.error(`${url} request error`, errMsg);
        throw new Error(errMsg.toString());
      }
      logger.error(`${url} request error`, _.get(e, "message", ""));
      throw new Error(_.get(e, "message", ""));
    }
  }
}
export { BinanceSpotRequest };
