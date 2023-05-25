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
      return _.get(axiosResponse, "data", []);
      // logger.info(axiosResponse);
    } catch (e) {
      throw e;
    }
  }
}

export { PortfolioRequest };
