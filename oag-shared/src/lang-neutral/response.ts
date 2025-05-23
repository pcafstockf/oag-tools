import {InjectionToken} from 'async-injection';
import {OpenAPIV3_1} from 'openapi-types';
import {OpenApiLangNeutral} from './lang-neutral';
import {Model} from './model';

/**
 * All CodeGenAst Method have a 'Response', but OpenApi v3.1 allows optional ResponsesObject in order to support
 * things like web sockets, etc.  'OpenApiResponse' is what will be found in most REST apis.
 */
export interface Response {
	readonly model: Model;
}

/**
 * @inheritDoc
 * This specialization is used whenever the OpenApi specification defines a ResponsesObject.
 */
export interface OpenApiResponse extends Response, OpenApiLangNeutral<OpenAPIV3_1.ResponseObject, Response> {
}

export const CodeGenOpenApiResponseToken = new InjectionToken<OpenApiResponse>('codegen-openapi-response');
