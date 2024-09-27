import {InjectionToken} from 'async-injection';
import {OpenAPIV3_1} from 'openapi-types';
import {LangNeutral, OpenApiLangNeutral} from './lang-neutral';
import {Model} from './model';

/**
 * All CodeGenAst Method have a 'Response', but OpenApi v3.1 allows optional ResponsesObject in order to support
 * things like web sockets, etc.  'OpenApiResponse' is what will be found in most REST apis.
 */
export interface Response<LANG_REF = unknown, MODEL_LANG_REF = unknown> extends LangNeutral<LANG_REF> {
	readonly model: Model<MODEL_LANG_REF>;
}

/**
 * @inheritDoc
 * This specialization is used whenever the OpenApi specification defines a ResponsesObject.
 */
export interface OpenApiResponse<LANG_REF = unknown, MODEL_LANG_REF = unknown> extends Response<LANG_REF, MODEL_LANG_REF>, OpenApiLangNeutral<OpenAPIV3_1.ResponseObject, Response> {
}

export function isOpenApiResponse(obj: Response): obj is OpenApiResponse {
	return typeof (obj as unknown as OpenApiResponse).oae !== 'undefined';
}

export const CodeGenOpenApiResponseToken = new InjectionToken<OpenApiResponse>('codegen-openapi-response');
export const CodeGenAltResponseToken = new InjectionToken<(model: Model, ...args: any[]) => Response>('codegen-alt-response');
