import {OperationDesc} from './client-types';
import {HttpResponse} from "./http-client";

/**
 * Pre-processing af an http request.
 */
export type ReqTransformerFn = (op: OperationDesc, urlPath: string, hdrs: Record<string, string>, cookies: Record<string, () => string>, security?: ReadonlyArray<Record<string, string[]>>) => Promise<Record<string, () => string>>;

/**
 * Post-processing of an http response.
 */
export type ResTransformerFn = (op: OperationDesc, rsp: HttpResponse) => Promise<HttpResponse>;
