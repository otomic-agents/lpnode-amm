class Gas {
  public getGasUsd(): number {
    return 0.0005;
  }

  public async setGasUsd(): Promise<boolean> {
    return true;
  }
}
const gas: Gas = new Gas();
export { gas };
