import axios from "axios";
import { httpsKeepAliveAgent } from "../../../sys_lib/http_agent";
import { logger } from "../../../sys_lib/logger";
import * as _ from "lodash";
class BinanceFutureRequest {
  public async get(url: string) {
    try {
      const result = await axios.request({
        httpsAgent: httpsKeepAliveAgent,
        url,
      });
      return _.get(result, "data", null);
    } catch (e) {
      const errMsg: any = _.get(e, "response.data.msg", "");
      if (errMsg !== "") {
        logger.error(`${url} 访问发生了错误`, errMsg);
        throw new Error(errMsg.toString());
      }
      logger.error(`${url} 发送请求发生了错误`, _.get(e, "message", ""));
      throw new Error(_.get(e, "message", ""));
    }
  }
}
export { BinanceFutureRequest };
