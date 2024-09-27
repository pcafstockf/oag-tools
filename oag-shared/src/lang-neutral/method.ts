import {InjectionToken} from 'async-injection';
import {OpenAPIV3_1} from 'openapi-types';
import {IdentifiedLangNeutral, LangNeutral, OpenApiLangNeutral} from './lang-neutral';
import {Parameter} from './parameter';
import {Response} from './response';

interface MethodT<LANG_REF = unknown> extends LangNeutral<LANG_REF>, IdentifiedLangNeutral {
	/**
	 * The URI path component for this method.
	 */
	readonly pathPattern: string;

	/**
	 * An ordered list of the arguments to this method.
	 * required will come first, followed by optional.
	 * The body (if any) will be the last in its associated group (required or optional).
	 */
	readonly parameters: ReadonlyArray<Readonly<Parameter<unknown>>>;

	/**
	 * Keys are http status code responses in the form: 201, or 2xx, or default.
	 * Values capture the Model for that particular response code.
	 */
	readonly responses: ReadonlyMap<string, Readonly<Response>>;

	/**
	 * This is *only* defined when code is being generated for a client.
	 * It is an ordered list of the preferred values for the Accept header.
	 */
	readonly preferredAcceptTypes?: ReadonlyArray<string>;
}

export interface Method<LANG_REF = unknown> extends MethodT<LANG_REF>, OpenApiLangNeutral<OpenAPIV3_1.OperationObject, MethodT> {
}

export const CodeGenMethodToken = new InjectionToken<Method>('codegen-method');
