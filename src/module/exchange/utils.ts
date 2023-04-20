import BigNumber from "bignumber.js";
import * as crypto from "crypto";
import { SystemMath } from "../../utils/system_math";

interface ILocalOrderInfo {
  marketType: string;
  orderIndex: number;
  price: number;
}

function signatureObject(object: any, apiSecret: string) {
  if (!object) {
    return "";
  }
  let retStr = "";
  const params: string[] = [];
  for (const key of Object.keys(object)) {
    params.push(`${key}=${object[key]}`);
  }
  retStr = params.join("&");

  const signedStr = crypto
    .createHmac("sha256", apiSecret)
    .update(retStr)
    .digest("hex");
  return `${retStr}&signature=${signedStr}`;
}

const encodeSize = 32;

function createOrderId(
  marketType: string,
  indexNumber: number,
  price: number
): string {
  const marketTypeStr = "S";
  const indexStr = new BigNumber(indexNumber).toString(encodeSize);
  const priceStr = new BigNumber(price).toFixed(8).toString();
  const pl = priceStr.split(".");
  const price0 = new BigNumber(pl[0]).toString(encodeSize);
  const price1 = new BigNumber(pl[1]).toString(encodeSize);
  const sourceIdStr = `${marketTypeStr}_${indexStr}_${price0}_${price1}`;

  return sourceIdStr;
}

function parseOrderId(orderStr: string): ILocalOrderInfo {
  // S_2vbo80_msdg_l70h9
  // orderStr = "S_2vbo80_msdg_l70h9"
  const orderInfoList = orderStr.split("_");
  const index = Number(
    new BigNumber(orderInfoList[1], encodeSize).toString(10)
  );

  const price0 = new BigNumber(orderInfoList[2], encodeSize).toString(10);
  const price1 = new BigNumber(orderInfoList[3], encodeSize).toString(10);

  const price = Number(new BigNumber(`${price0}.${price1}`).toString(10));
  return {
    marketType: (() => {
      if (orderInfoList[0] === "S") return "Spot";
      return "";
    })(),
    orderIndex: index,
    price,
  };
}

function formatStepSize(input: string, stepFormat: string): [number, number] {
  const digit = SystemMath.exec(`1/${stepFormat}`);
  const digitNumber = Number(digit).toString().length - 1;
  const ret = Number(new BigNumber(input).toFixed(digitNumber).toString());
  const lostNumber = SystemMath.execNumber(`${input}-${ret}`);
  return [ret, lostNumber];
}

export {
  signatureObject,
  createOrderId,
  parseOrderId,
  ILocalOrderInfo,
  formatStepSize,
};
