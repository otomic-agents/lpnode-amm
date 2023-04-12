import { EthUnit } from "../utils/eth";

console.log(EthUnit.toWei("1000", 18));

console.log(EthUnit.fromWei("1000000000000000000000", 18));


console.log(typeof EthUnit.fromWei("1000000000000000000000", 18));
