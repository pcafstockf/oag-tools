// Placeholder file to keep imports happy inside the generator project.
// Generated code will contain client-transformers.browser.ts or client-transformers.node.ts.
import {OperationDesc} from "./client-types";
import {HttpResponse} from "./http-client";

export type ReqTransformerFn = (op: OperationDesc, urlPath: string, hdrs: Record<string, string>, cookies: Record<string, string>, security?: ReadonlyArray<Record<string, string[]>>) => Promise<Record<string, string>>;
export type ResTransformerFn = (op: OperationDesc, rsp: HttpResponse) => Promise<HttpResponse>;
