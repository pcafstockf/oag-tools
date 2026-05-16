import {OperationDesc} from './client-types';
import {HttpResponse} from "./http-client";

/**
 * Pre-processing of an outgoing HTTP request. Called once per operation before the request is sent.
 *
 * @param op      - Descriptor for the operation being invoked (id, HTTP method, URL pattern).
 * @param urlPath - Resolved URL path for this call (parameters already substituted).
 * @param hdrs    - Mutable headers object; add or overwrite entries to inject request headers.
 * @param cookies - Mutable cookies map; values are lazy getters that return the cookie string.
 * @param security - Preference-ordered list of security schemes acceptable for this operation, derived from the API spec.
 *                   Each entry is a map of scheme name → required scopes (e.g. `[{ bearerAuth: [] }]`).
 *                   Implementors should apply the first scheme they understand and skip auth entirely when the array is empty.
 * @returns The (possibly updated) cookies map.
 */
export type ReqTransformerFn = (op: OperationDesc, urlPath: string, hdrs: Record<string, string>, cookies: Record<string, () => string>, security?: ReadonlyArray<Record<string, string[]>>) => Promise<Record<string, () => string>>;

/**
 * Post-processing of an http response.
 */
export type ResTransformerFn = (op: OperationDesc, rsp: HttpResponse) => Promise<HttpResponse>;
