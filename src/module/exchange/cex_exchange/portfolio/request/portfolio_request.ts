import axios from "axios";
// import { logger } from "../../../../../sys_lib/logger";
import * as _ from "lodash";
class PortfolioRequest {
  public async get(url: string) {
    try {
      const axiosResponse = await axios.request({
        method: "get",
        url,
      });
      const code = _.get(axiosResponse, "data.code", -1);
      if (code !== 0) {
        throw new Error(
          `${url},service response an error:${_.get(
            axiosResponse,
            "data.msg",
            ""
          )}`
        );
      }
      return _.get(axiosResponse, "data", []);
      // logger.info(axiosResponse);
    } catch (e) {
      throw e;
    }
  }
}

export { PortfolioRequest };
