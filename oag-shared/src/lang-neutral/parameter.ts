import {InjectionToken} from 'async-injection';
import {OpenAPIV3_1} from 'openapi-types';
import {IdentifiedLangNeutral, LangNeutral} from './lang-neutral';
import {Model} from './model';

export interface AbsParameter<OAE, LANG_REF = unknown, MODEL_LANG_REF = unknown> extends LangNeutral<OAE, LANG_REF>, IdentifiedLangNeutral {
	readonly kind: 'param' | 'body';
	readonly required?: boolean;
	readonly model: Model<MODEL_LANG_REF>;
}

export interface NamedParameter<LANG_REF = unknown, MODEL_LANG_REF = unknown> extends AbsParameter<OpenAPIV3_1.ParameterObject, LANG_REF, MODEL_LANG_REF> {
	readonly kind: 'param';
}

export const CodeGenNamedParameterToken = new InjectionToken<NamedParameter>('codegen-named-parameter');

export interface BodyParameter<LANG_REF = unknown, MODEL_LANG_REF = unknown> extends AbsParameter<OpenAPIV3_1.RequestBodyObject, LANG_REF, MODEL_LANG_REF> {
	readonly kind: 'body';
	/**
	 * This is only defined when code is being generated for a client.
	 * It is an ordered list of the preferred content encoding for the request (most to least).
	 */
	readonly preferredMediaTypes?: ReadonlyArray<string>;
}

export const CodeGenBodyParameterToken = new InjectionToken<BodyParameter>('codegen-body-parameter');
