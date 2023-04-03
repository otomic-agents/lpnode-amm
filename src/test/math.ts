import { SystemMath } from "../utils/system_math";

const exeContext = SystemMath.getExecContext();
exeContext.evaluate("x=100*100");
console.log(exeContext.get("x"));
