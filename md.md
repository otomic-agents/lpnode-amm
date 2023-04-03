## 编译

> npx gulp

## 启动

> node dist/main.js

## 开发环境

> 需要配置 typescript 自动编译

## 打包镜像

> docker build -t magicpigdocker/amm:v0.9 .

## 流程示意

1. 用户选择币对
2. 用户选择对应的报价
3. 选择报价后弹窗，Confirm 之后 Event_Lock_Quote
4. 用户授权币对
5. 用户 Lock [用户钱包->合约]，产生 EVENT_TRANSFER_OUT -> CMD_TRANSFER_IN (要求 B 链转入)
6. 等待用户 Confirm
7.

EVENT_TRANSFER_OUT_CONFIRM -> CMD_TRANSFER_IN_CONFIRM

EVENT_TRANSFER_OUT_REFUND -> CMD_TRANSFER_IN_REFUND

##

```js
https://tooltt.com/sequence/

LP_Main-->LP_Node: CMD_UPDATE_QUOTE(报价)
User->LP_Node: Config 确认价格（弹出流程窗口）
LP_Node->LP_Main: EVENT_LOCK_QUOTE
Note left of LP_Main: (1)检查报价是否存在\n(2)检查价差是否合理\n(3)检查目标链余额\n(4)检查对冲余额\n(5)锁定对冲账户余额
LP_Main-->LP_Node: CALLBACK_LOCK_QUOTE
Note right of LP_Node: 超时暂未处理?
Note right of User: 弹出流程窗口
User->LP_Node: Lock
Note right of LP_Node: A 链 Token-Contract
LP_Node->LP_Main: EVENT_TRANSFER_OUT
Note left of LP_Main: (1)检查目标链余额\n(2)转入的数量是否和报价一致\n(3)时效性检查\n?缺少失败时的反馈
LP_Main-->LP_Node: CMD_TRANSFER_IN
Note right of LP_Node: B 链 Token-Contract
User->LP_Node: Confirm 释放 A 链 Token 到 Bridge
Note right of LP_Node: A 链到 Bridge\n
LP_Node->LP_Main: EVENT_TRANSFER_OUT_CONFIRM
Note left of LP_Main: (1)处理对冲的逻辑\n(2)使用当前市价进行对冲\n(3)对冲亏损较大时取消交易\n(4)CMD_TRANSFER_IN 执行时间检查\n？这里可能需要确定的 TRANSFER_IN\n(5)解锁对冲余额
LP_Main-->LP_Node: CMD_TRANSFER_IN_CONFIRM
Note right of LP_Node: 释放 Token 给 User

LP_Main-->LP_Node: CMD_UPDATE_QUOTE(报价)
User->LP_Node: Config 确认价格（弹出流程窗口）
LP_Node->LP_Main: EVENT_LOCK_QUOTE
Note left of LP_Main: (1)检查报价是否存在\n(2)检查价差是否合理
LP_Main-->LP_Node: CALLBACK_LOCK_QUOTE
Note right of LP_Node: 超时暂未处理?
Note right of User: 弹出流程窗口
User->LP_Node: Lock
Note right of LP_Node: A 链 Token-Contract
LP_Node->LP_Main: EVENT_TRANSFER_OUT
Note left of LP_Main: (1)检查目标链余额\n(2)转入的数量是否和报价一致\n(3)时效性检查\n?缺少失败时的反馈
LP_Main-->LP_Node: CMD_TRANSFER_IN
Note right of LP_Node: B 链 Token-Contract
User->LP_Node: REFUND
LP_Node->LP_Main: EVENT_TRANSFER_OUT_REFUND
Note left of LP_Main: 保证发起 CMD_TRANSFER_IN_REFUND
LP_Main-->LP_Node: CMD_TRANSFER_IN_REFUND
```
