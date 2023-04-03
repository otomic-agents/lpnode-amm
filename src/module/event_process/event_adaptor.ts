import _ from "lodash";
import { dataConfig } from "../../data_config";
import { logger } from "../../sys_lib/logger";

class EventAdaptor {
  /**
   * Description 从EventLock Data中获取Token 信息对
   * @date 1/18/2023 - 12:03:08 PM
   *
   * @public
   * @param {*} sourceMessage 原始信息
   * @returns {string} ""
   */
  public getTokenSymbolFromEventLock(sourceMessage: any): string {
    const srcToken = _.get(
      sourceMessage,
      "pre_business.swap_asset_information.quote.quote_base.bridge.src_token",
      null
    );
    const dstToken = _.get(
      sourceMessage,
      "pre_business.swap_asset_information.quote.quote_base.bridge.dst_token",
      null
    );
    if (srcToken === null || dstToken === null) {
      return "";
    }
    return `${srcToken}/${dstToken}`;
  }
  public getChainIdFromEventLock(sourceMessage: any): [number, number] {
    const srcChainId = _.get(
      sourceMessage,
      "pre_business.swap_asset_information.quote.quote_base.bridge.src_chain_id",
      0
    );
    const dstChainId = _.get(
      sourceMessage,
      "pre_business.swap_asset_information.quote.quote_base.bridge.dst_chain_id",
      0
    );
    if (srcChainId === 0 || dstChainId === 0) {
      logger.error("获取链信息失败");
      return [0, 0];
    }
    return [srcChainId, dstChainId];
  }
  public getTokenFromEventLock(
    sourceMessage: any
  ): [string | undefined, string | undefined] {
    const srcToken = _.get(
      sourceMessage,
      "pre_business.swap_asset_information.quote.quote_base.bridge.src_token",
      null
    );
    const dstToken = _.get(
      sourceMessage,
      "pre_business.swap_asset_information.quote.quote_base.bridge.dst_token",
      null
    );
    if (srcToken === null || dstToken === null) {
      return [undefined, undefined];
    }
    return [srcToken, dstToken];
  }
  public getTokenSymbolFromEventTransferOut(sourceMessage: any): string {
    const srcToken = _.get(
      sourceMessage,
      "business_full_data.pre_business.swap_asset_information.quote.quote_base.bridge.src_token",
      null
    );
    const dstToken = _.get(
      sourceMessage,
      "business_full_data.pre_business.swap_asset_information.quote.quote_base.bridge.dst_token",
      null
    );
    if (srcToken === null || dstToken === null) {
      return "";
    }
    return `${srcToken}/${dstToken}`;
  }
  public getTokenSymbolFromEventTransferOutConfirm(sourceMessage: any): string {
    const srcToken = _.get(
      sourceMessage,
      "business_full_data.pre_business.swap_asset_information.quote.quote_base.bridge.src_token",
      null
    );
    const dstToken = _.get(
      sourceMessage,
      "business_full_data.pre_business.swap_asset_information.quote.quote_base.bridge.dst_token",
      null
    );
    if (srcToken === null || dstToken === null) {
      return "";
    }
    return `${srcToken}/${dstToken}`;
  }

  /**
   * Description 根据tokenSymbol 找到需要返回的通道
   * @date 1/18/2023 - 12:10:19 PM
   *
   * @public
   * @param {string} tokenSymbol address/address
   * @returns {string} ""
   */
  public getChannelWithTokenSymbol(tokenSymbol: string): string {
    const tokenList = tokenSymbol.split("/");
    if (tokenList.length !== 2) {
      return "";
    }
    const bridgeItemInfo = dataConfig.findMsgChannelByStrTokenAndDstToken(
      tokenList[0],
      tokenList[1]
    );
    return _.get(bridgeItemInfo, "msmq_name", "");
  }
}

const eventAdaptor: EventAdaptor = new EventAdaptor();
export { eventAdaptor };
