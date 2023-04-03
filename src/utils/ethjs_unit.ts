import BigNumber from "bignumber.js";
import * as _ from "lodash";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const BN = require("bn.js");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const numberToBN = require("number-to-bn");

const zero = new BN(0);
const negative1 = new BN(-1);

// complete ethereum unit map
const unitMap = {
  noether: "0", // eslint-disable-line
  wei: "1", // eslint-disable-line

  // 这几个精度都是原版没有的，后来加的
  hwei: "100", // eslint-disable-line
  kwei: "1000", // eslint-disable-line
  tenkwei: "10000", // eslint-disable-line
  hkwei: "100000", // eslint-disable-line
  mwei: "1000000", // eslint-disable-line
  tenmwei: "10000000", // eslint-disable-line
  hmwei: "100000000", // eslint-disable-line
  gwei: "1000000000", // eslint-disable-line
  twei: "10000000000", // eslint-disable-line
  microether: "1000000000000", // eslint-disable-line
  milliether: "1000000000000000", // eslint-disable-line
  ether: "1000000000000000000", // eslint-disable-line
  kether: "1000000000000000000000", // eslint-disable-line
  mether: "1000000000000000000000000", // eslint-disable-line
  gether: "1000000000000000000000000000", // eslint-disable-line
  tether: "1000000000000000000000000000000", // eslint-disable-line
};
const unitMapToMap = {
  0: "wei",
  2: "hwei",
  3: "kwei",
  4: "tenkwei",
  6: "mwei",
  8: "hmwei",
  9: "gwei",
  10: "twei",
  12: "microether",
  15: "milliether",
  18: "ether",
  21: "kether",
  24: "mether",
  27: "gether",
  30: "tether",
};

/**
 * Returns value of unit in Wei
 *
 * @method getValueOfUnit
 * @param {String} unitInput the unit to convert to, default ether
 * @returns {BigNumber} value of the unit (in Wei)
 * @throws error if the unit is not correct:w
 */
function getValueOfUnit(unitInput) {
  const unit = unitInput ? unitInput.toLowerCase() : "ether";
  var unitValue = unitMap[unit]; // eslint-disable-line

  if (typeof unitValue !== "string") {
    throw new Error(
      `[ethjs-unit] the unit provided ${unitInput} doesn't exists, please use the one of the following units ${JSON.stringify(
        unitMap,
        null,
        2
      )}`
    );
  }

  return new BN(unitValue, 10);
}

function getNumberFrom16(input: string, decimals = 18) {
  const numberStrVal = new BigNumber(
    new BigNumber(input).div(new BigNumber(10).pow(decimals)).toString(10)
  ).toFixed(5);
  const number = Number(numberStrVal);
  if (!_.isFinite(number)) {
    throw new Error(`转换格式失败,input:${input} `);
  }
  return number;
}

function getNumber16Str(input: number, decimals = 18) {
  decimals = decimals++;
  return new BigNumber(input).times(new BigNumber(10).pow(decimals)).toString();
}

function numberToString(arg) {
  if (typeof arg === "string") {
    if (!arg.match(/^-?[0-9.]+$/)) {
      throw new Error(
        `while converting number to string, invalid number value '${arg}', should be a number matching (^-?[0-9.]+).`
      );
    }
    return arg;
  } else if (typeof arg === "number") {
    return String(arg);
  } else if (
    typeof arg === "object" &&
    arg.toString &&
    (arg.toTwos || arg.dividedToIntegerBy)
  ) {
    if (arg.toPrecision) {
      return String(arg.toPrecision());
    }
    // eslint-disable-line
    return arg.toString(10);
  }
  throw new Error(
    `while converting number to string, invalid number value '${arg}' type ${typeof arg}.`
  );
}

function fromWei(weiInput, unit, optionsInput: any = undefined) {
  var wei = numberToBN(weiInput); // eslint-disable-line
  var negative = wei.lt(zero); // eslint-disable-line
  const base = getValueOfUnit(unit);
  const baseLength = unitMap[unit].length - 1 || 1;
  const options = optionsInput || {};

  if (negative) {
    wei = wei.mul(negative1);
  }

  let fraction = wei.mod(base).toString(10); // eslint-disable-line

  while (fraction.length < baseLength) {
    fraction = `0${fraction}`;
  }

  if (!options.pad) {
    fraction = fraction.match(/^([0-9]*[1-9]|0)(0*)/)[1];
  }

  let whole = wei.div(base).toString(10); // eslint-disable-line

  if (options.commify) {
    whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  var value = `${whole}${fraction == "0" ? "" : `.${fraction}`}`; // eslint-disable-line

  if (negative) {
    value = `-${value}`;
  }

  return value;
}

function toWei(etherInput, unit) {
  var ether = numberToString(etherInput); // eslint-disable-line
  const base = getValueOfUnit(unit);
  const baseLength = unitMap[unit].length - 1 || 1;

  // Is it negative?
  var negative = ether.substring(0, 1) === "-"; // eslint-disable-line
  if (negative) {
    ether = ether.substring(1);
  }

  if (ether === ".") {
    throw new Error(
      `[ethjs-unit] while converting number ${etherInput} to wei, invalid value`
    );
  }

  // Split it into a whole and fractional part
  var comps = ether.split("."); // eslint-disable-line
  if (comps.length > 2) {
    throw new Error(
      `[ethjs-unit] while converting number ${etherInput} to wei,  too many decimal points`
    );
  }
  let whole = comps[0],
    fraction = comps[1]; // eslint-disable-line

  if (!whole) {
    whole = "0";
  }
  if (!fraction) {
    fraction = "0";
  }
  if (fraction.length > baseLength) {
    throw new Error(
      `[ethjs-unit] while converting number ${etherInput} to wei, too many decimal places`
    );
  }

  while (fraction.length < baseLength) {
    fraction += "0";
  }

  whole = new BN(whole);
  fraction = new BN(fraction);
  let wei = whole.mul(base).add(fraction); // eslint-disable-line

  if (negative) {
    wei = wei.mul(negative1);
  }

  return new BN(wei.toString(10), 10);
}

export {
  getNumber16Str,
  unitMap,
  numberToString,
  getValueOfUnit,
  fromWei,
  toWei,
  unitMapToMap,
  getNumberFrom16,
};
