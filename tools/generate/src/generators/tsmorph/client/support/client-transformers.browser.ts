import {OperationDesc} from './client-types';
import {HttpResponse} from "./http-client";

type RequestFnReturnType = void | undefined | 'omit' | 'same-origin' | 'include';

/**
 * Pre-processing of an outgoing HTTP request. Called once per operation before the request is sent.
 *
 * @param op      - Descriptor for the operation being invoked (id, HTTP method, URL pattern).
 * @param urlPath - Resolved URL path for this call (parameters already substituted).
 * @param hdrs    - Mutable headers object; add or overwrite entries to inject request headers.
 * @param credentials -
 * @param security - Preference-ordered list of security schemes acceptable for this operation, derived from the API spec.
 *                   Each entry is a map of scheme name → required scopes (e.g. `[{ bearerAuth: [] }]`).
 *                   Implementors should apply the first scheme they understand and skip auth entirely when the array is empty.
 */
export type ReqTransformerFn = (op: OperationDesc, urlPath: string, hdrs: Record<string, string>, credentials: RequestFnReturnType, security?: ReadonlyArray<Record<string, string[]>>) => Promise<RequestFnReturnType>;

export type ResTransformerFn = (op: OperationDesc, rsp: HttpResponse) => Promise<HttpResponse>;
