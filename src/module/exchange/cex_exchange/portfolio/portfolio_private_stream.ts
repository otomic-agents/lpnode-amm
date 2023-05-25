const Emittery = require("emittery");
class PortfolioPrivateStream extends Emittery {
  private accountId: string;
  constructor(accountId: string) {
    super();
    this.accountId = accountId;
    setInterval(() => {
      this.emit("streamEvent", {
        action: "order",
        payload: {},
      });
    }, 5000);
  }
}
export { PortfolioPrivateStream };
