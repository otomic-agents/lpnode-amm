async function AsyncEach(list: any[], itemFun: any) {
  if (typeof itemFun !== "function") {
    return [];
  }

  const promises = list.map(async (item) => {
    try {
      const ret = await itemFun(item);
      return ret;
    } catch (error) {
      throw error;
    }
  });

  const results = await Promise.all(promises);

  const finalResult: any[] = [];
  for (let i = 0; i < results.length; i++) {
    if (results[i] === false) {
      return finalResult;
    }
    finalResult.push(results[i]);
  }

  return finalResult;
}

export { AsyncEach };
