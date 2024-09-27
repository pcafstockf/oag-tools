import {InjectionToken} from 'async-injection';
import {OpenAPIV3_1} from 'openapi-types';
import {IdentifiedLangNeutral, LangNeutral, OpenApiLangNeutral} from './lang-neutral';
import {Model} from './model';

export type ParameterKind = 'named' | 'body';

/**
 * From a CodeGenAst viewpoint, everything passed to a @see Method is just a 'Parameter'.
 */
export interface Parameter<LANG_REF = unknown, KIND extends ParameterKind = ParameterKind, MODEL_LANG_REF = unknown> extends LangNeutral<LANG_REF>, IdentifiedLangNeutral {
	readonly kind: KIND;
	readonly name: string;
	readonly required?: boolean;
	readonly model: Model<MODEL_LANG_REF>;
}

/**
 * Technically, all 'Parameter' have a name, but when based on OpenAPIV3_1.ParameterObject, the name is in the specification.
 */
export interface NamedParameter<LANG_REF = unknown, MODEL_LANG_REF = unknown> extends Parameter<LANG_REF, 'named', MODEL_LANG_REF>, OpenApiLangNeutral<OpenAPIV3_1.ParameterObject, Parameter> {
}

export const CodeGenNamedParameterToken = new InjectionToken<NamedParameter>('codegen-named-parameter');

/**
 * OpenAPIV3_1.RequestBodyObject requires a much different internal approach to being a 'Parameter'.
 */
export interface BodyParameter<LANG_REF = unknown, MODEL_LANG_REF = unknown> extends Parameter<LANG_REF, 'body', MODEL_LANG_REF>, OpenApiLangNeutral<OpenAPIV3_1.RequestBodyObject, Parameter> {
	/**
	 * This is only defined when code is being generated for a client.
	 * It is an ordered list of the preferred content encoding for the request (most to least).
	 */
	readonly preferredMediaTypes?: ReadonlyArray<string>;
}

export const CodeGenBodyParameterToken = new InjectionToken<BodyParameter>('codegen-body-parameter');
