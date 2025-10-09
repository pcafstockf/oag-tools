import {OperationDesc} from './client-types';
import {HttpResponse} from "./http-client";

type RequestFnReturnType = void | undefined | 'omit' | 'same-origin' | 'include';

export type ReqTransformerFn = (op: OperationDesc, urlPath: string, hdrs: Record<string, string>, credentials: RequestFnReturnType, security?: ReadonlyArray<Record<string, string[]>>) => Promise<RequestFnReturnType>;

export type ResTransformerFn = (op: OperationDesc, rsp: HttpResponse) => Promise<HttpResponse>;
