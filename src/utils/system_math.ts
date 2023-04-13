import { create, all } from "mathjs";
import * as mathlib from "mathjs";
// configure the default type of numbers as BigNumbers

const mathIns = create(all);
mathIns.config({ number: "BigNumber", precision: 20 });
class SystemMath {
  static exec(formula: string, title = ""): mathlib.BigNumber {
    console.log(`${title}_____________:`);
    console.log("             ", formula);
    console.log(
      "________________________________________________________________________"
    );
    return mathIns.evaluate(formula);
  }

  static getExecContext(): mathlib.Parser {
    const parser = mathIns.parser();
    return parser;
  }
}

export { SystemMath };
