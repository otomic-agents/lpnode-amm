import { ISymbolsManager } from "./symbols_manager";
interface IOrderbook {
  spotOrderbookOnceLoaded: boolean;
  getSpotOrderbook(stdSymbol): any;

  init(): Promise<void>;
  setSymbolsManager(symbolsManager: ISymbolsManager | undefined): void;
  refreshOrderbook(): Promise<void>;
}
export { IOrderbook };
