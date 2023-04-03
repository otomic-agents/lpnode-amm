class Gas {
  /**
   * 返回目前Gas 需要的费用Usd 计价格
   * @returns {number} *
   */
  public getGasUsd(): number {
    return 0.0005;
  }

  public async setGasUsd(): Promise<boolean> {
    return true;
  }
}
const gas: Gas = new Gas();
export { gas };
