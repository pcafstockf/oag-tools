// Placeholder file to keep ./index.ts happy while part of the generator itself.
import {AsyncLocalStorage} from "node:async_hooks";

export type Context = {};
export type FrameworkStorageCtx = AsyncLocalStorage<Context>;
