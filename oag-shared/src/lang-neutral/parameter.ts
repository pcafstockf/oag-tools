import {InjectionToken} from 'async-injection';
import {OpenAPIV3_1} from 'openapi-types';
import {IdentifiedLangNeutral, OpenApiLangNeutral} from './lang-neutral';
import {Model} from './model';

export type ParameterKind = 'named' | 'body';

/**
 * From a CodeGenAst viewpoint, everything passed to a @see Method is just a 'Parameter'.
 */
export interface Parameter<KIND extends ParameterKind = ParameterKind> extends IdentifiedLangNeutral {
	readonly kind: KIND;
	readonly name: string;
	readonly required?: boolean;
	readonly model: Readonly<Model>;
}

/**
 * Technically, all 'Parameter' have a name, but when based on OpenAPIV3_1.ParameterObject, the name is in the specification.
 */
export interface NamedParameter extends Parameter<'named'>, OpenApiLangNeutral<OpenAPIV3_1.ParameterObject, Parameter<'named'>> {
	/**
	 * An oag-tools specific key for a table of OpenAPi Parameter encoding algorithms.
	 * e.g. style = matrix, simple, form, spaceDelimited, etc.
	 * some styles can be combined with an exploded encoding.
	 * See the OpenApi spec for all the way OpenAPIV3_1.ParameterObject can be transported.
	 */
	readonly serializerKey: string;
}

export const CodeGenNamedParameterToken = new InjectionToken<NamedParameter>('codegen-named-parameter');

/**
 * OpenAPIV3_1.RequestBodyObject requires a much different internal approach to being a 'Parameter'.
 */
export interface BodyParameter extends Parameter<'body'>, OpenApiLangNeutral<OpenAPIV3_1.RequestBodyObject, Parameter<'body'>> {
	/**
	 * This is only defined when code is being generated for a client.
	 * It is an ordered list of the preferred content encoding for the request (most to least).
	 */
	readonly preferredMediaTypes?: ReadonlyArray<string>;
}

export const CodeGenBodyParameterToken = new InjectionToken<BodyParameter>('codegen-body-parameter');
