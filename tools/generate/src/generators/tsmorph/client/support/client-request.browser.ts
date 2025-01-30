import {OperationDesc} from './client-types';

type RequestFnReturnType = void | undefined | 'omit' | 'same-origin' | 'include';

export type RequestEnhancerFn = (op: Readonly<OperationDesc>, urlPath: string, hdrs: Record<string, string>) => Promise<RequestFnReturnType>;

export type RequestAuthFn = (op: OperationDesc, security: ReadonlyArray<Record<string, string[]>>, urlPath: string, hdrs: Record<string, string>, credentials: RequestFnReturnType) => Promise<RequestFnReturnType>;
