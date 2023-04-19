import * as mathlib from "mathjs";
import { all, create } from "mathjs";
import { logger } from "../sys_lib/logger";
import * as _ from "lodash";
// configure the default type of numbers as BigNumbers
const replaceall = require("replaceall");
const mathIns = create(all);
mathIns.config({ number: "BigNumber", precision: 20 });

class SystemMath {
  static exec(formula: string, title = ""): mathlib.BigNumber {
    formula = replaceall("\n", "", formula);
    console.log(`${title}\n`);
    console.log("♨️", formula, "♨️");
    return mathIns.evaluate(formula);
  }

  static execNumber(formula: string, title = "", debug = true): number {
    formula = replaceall("\n", "", formula);

    const ret = Number(mathIns.evaluate(formula).toFixed(8));
    if (debug === true) {
      console.log(`${title}`, "❎", formula, "=", ret);
    }
    return ret;
  }

  static getExecContext(): mathlib.Parser {
    const parser = mathIns.parser();
    return parser;
  }

  static formatSize(format: string, input: string) {
    //
  }

  static min(values: number[]): number {
    const usedNumberList: number[] = [];
    for (const item of values) {
      logger.debug(item);
      if (item >= 0) {
        usedNumberList.push(item);
      }
    }
    return <number>_.min(usedNumberList);
  }
  static max(values: number[]): number {
    const usedNumberList: number[] = [];
    for (const item of values) {
      logger.debug(item);
      if (item >= 0) {
        usedNumberList.push(item);
      }
    }
    return <number>_.max(usedNumberList);
  }
}

export { SystemMath };
