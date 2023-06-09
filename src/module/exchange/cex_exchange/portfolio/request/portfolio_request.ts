import axios from "axios";
// import { logger } from "../../../../../sys_lib/logger";
import * as _ from "lodash";
import { logger } from "../../../../../sys_lib/logger";
const bcrypt = require('bcrypt')
class PortfolioRequestManager {
  private appKey = "bytetrade_otmoiclp_219538"
  private appSecret = "cf28e46f66ed8aca"
  private userName = "bigdog"
  private accessToken = "";
  public getAccessToken() {

    return this.accessToken;
  }
  constructor() {

    
  }
  public async init(){
    await this.refreshToken()
  }
  public async refreshToken() {
    const timestamp = (new Date().getTime() / 1000).toFixed(0);
    const text = this.appKey + timestamp + this.appSecret;
    const token = await bcrypt.hash(text, 10);
    const body = {
      "app_key": this.appKey,
      "timestamp": parseInt(timestamp),
      "token": token,
      "perm": { "group": "portfolio", "dataType": "key", "version": "v1", "ops": ["Account","MarketInfo", "SubMarkets", "Depth", "Deal","AddSubMarkets","CreateOrder"] }
    }
    try{

      const response = await axios.request({
        method: "post",
        url: `http://system-server.user-system-${this.userName}/permission/v1alpha1/access`,
        data: body
      })
      const accessToken = _.get(response, "data.data.access_token", undefined);
      if (!accessToken) {
        logger.error(`An error occurred requesting accessToken from the system`, _.get(response, "data", ""))
      }
      this.accessToken = accessToken
      logger.debug(`Obtained the token `,this.accessToken)
    }catch(e){

      logger.error(`An error occurred requesting accessToken from the system`,e)
    }finally{

      setTimeout(()=>{
        this.refreshToken()
      },1000*60*5)
    }

  }

}
const portfolioRequestManager: PortfolioRequestManager = new PortfolioRequestManager();
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
  public async post(opType:string,data:any){
    try {
      const axiosResponse = await axios.request({
        method: "post",
        url:`http://system-server.user-system-bigdog/system-server/v1alpha1/key/portfolio/v1/${opType}`,
        data:data,
        headers:{
          "Content-Type": "application/json",
          'X-Access-Token': portfolioRequestManager.getAccessToken(),
        }
      });
      const code = _.get(axiosResponse, "data.code", -1);
      if (code !== 0) {
        logger.error(`${opType},service response an error:${JSON.stringify(_.get(
          axiosResponse,
          "data",
          ""
        ))}`)
        throw new Error(
          `${opType},service response an error:${JSON.stringify(_.get(
            axiosResponse,
            "data.msg",
            ""
          ))}`
        );
      }
      // if (opType ==="Depth"){
      //   console.dir(_.get(axiosResponse, "data",""),ConsoleDirDepth5)
      // }
      
      return _.get(axiosResponse, "data.data", undefined);
      // logger.info(axiosResponse);
    } catch (e) {
      throw e;
    }
  }
}

export { PortfolioRequest,portfolioRequestManager };
