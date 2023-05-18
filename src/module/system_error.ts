import * as _ from "lodash";
const SystemErrorDict = {
  orderbook: {
    getError: {
      code: 10001,
      message: "Unable to get Orderbook",
    },
  },
};

class SystemError {
  static getError(errorItem: { code: number; message: string }) {
    const genError = new Error(errorItem.message);
    _.set(genError, "code", errorItem.code);
    return genError;
  }
  static getErrorMessage(errorItem: { code: number; message: string }) {
    return _.get(errorItem, "message", "");
  }
  static throwError(errorItem: { code: number; message: string }) {
    const genError = new Error(errorItem.message);
    _.set(genError, "code", errorItem.code);
    throw genError;
  }
}
export { SystemError, SystemErrorDict };
