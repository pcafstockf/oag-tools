import {OperationDesc} from './client-types';

export type RequestEnhancerFn = (op: Readonly<OperationDesc>, urlPath: string, hdrs: Record<string, string>, cookies: Record<string, () => string>) => Promise<Record<string, () => string>>;

export type RequestAuthFn = (op: OperationDesc, security: ReadonlyArray<Record<string, string[]>>, urlPath: string, hdrs: Record<string, string>, cookies: Record<string, () => string>) => Promise<Record<string, () => string>>;
