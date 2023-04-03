async function AsyncEach(list: any[], itemFun: any) {
  if (typeof itemFun !== "function") {
    return [];
  }

  const result: any[] = [];
  for (let i = 0; i < list.length; i++) {
    const ret = await itemFun(list[i]);
    if (ret === false) {
      // 中途break掉
      return result;
    }
    result.push(ret);
  }
  return result;
}

export { AsyncEach };
