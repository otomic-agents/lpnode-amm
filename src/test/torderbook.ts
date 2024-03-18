/* eslint-disable array-callback-return */
import { SystemMath } from "../utils/system_math";

/* eslint-disable arrow-parens */
const orderbook_asks = [
  [99, 300],
  [100, 1200],
  [108, 3000],
];

const level_1_asks = ((inputAmount: number) => {
  const total_amount = inputAmount;
  let left_amount = inputAmount;
  const execResult: any = [];
  orderbook_asks.map((it) => {
    const orderbook_amount = it[1];
    if (left_amount === 0) {
      return;
    }
    if (orderbook_amount >= left_amount) {
      execResult.push({ price: it[0], executeAmount: left_amount });
      left_amount = left_amount - left_amount;
    } else {
      execResult.push({ price: it[0], executeAmount: orderbook_amount });
      left_amount = left_amount - orderbook_amount;
    }
    //
  });
  if (left_amount > 0) {
    throw "orderbook cannot meet the quote";
  }
  let cost = 0;
  execResult.map((it) => {
    cost = SystemMath.execNumber(`${cost} +${it.executeAmount} * ${it.price}`);
  });
  console.log(execResult);
  return [SystemMath.execNumber(`${cost} / ${total_amount}`), inputAmount];
})(3000);

console.log(level_1_asks);
