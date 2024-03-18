import * as _ from "lodash";
class AdapterConfig {
  public getAdapterServiceBaseUrl(): string {
    const adapterServiceHost = _.get(
      process,
      "_sys_config.lp_market_host",
      undefined
    );
    const adapterServiceport = _.get(
      process,
      "_sys_config.lp_market_port",
      undefined
    );

    const url: string = `http://${adapterServiceHost}:${adapterServiceport}`;
    // logger.info("get Service Url", url);
    return url;
  }
}
const adapterConfig: AdapterConfig = new AdapterConfig();
export { adapterConfig };
