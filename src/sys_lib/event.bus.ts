// eslint-disable-next-line @typescript-eslint/no-var-requires
const Emittery = require("emittery");

const emitter = new Emittery();

const eventBus = emitter;
export { eventBus };
