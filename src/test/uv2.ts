import BigNumber from "bignumber.js";
import { logger } from "../sys_lib/logger";
import { fromWei } from "../utils/ethjs_unit";
const r0 = "68445375739621457522043457";
const r1 = "234900144650058700322573";
const r0Number = Number(fromWei(r0, "ether"));
const r1Number = Number(fromWei(r1, "ether"));

function swapToken01(inputValue: number, swapInfo: { r0: number; r1: number }) {
  const b0 = new BigNumber(swapInfo.r0);
  const b1 = new BigNumber(swapInfo.r1);
  const k = b0.times(b1);
  const amountInWithFee = new BigNumber(inputValue).times(0.997);
  // (100 + 1) * (2000 - N) = 100 * 2000，
  const rVal = k.div(b0.plus(amountInWithFee)); // (2000 - N)
  return b1.minus(rVal).toFixed(8).toString();
}
//  U-WBNB
function swapToken10(inputValue: number, swapInfo: { r0: number; r1: number }) {
  const b0 = new BigNumber(swapInfo.r0);
  const b1 = new BigNumber(swapInfo.r1);
  const k = b0.times(b1);
  const amountInWithFee = new BigNumber(inputValue).times(0.997);
  // (100 -N) * (2000 +1) = 100 * 2000，
  const rVal = k.div(b1.plus(new BigNumber(amountInWithFee))); // (2000 - N)
  return b0.minus(rVal).toFixed(8).toString();
}
logger.debug(swapToken01(1, { r0: r0Number, r1: r1Number }));
logger.debug(swapToken10(1, { r0: r0Number, r1: r1Number }));
