import {InjectionToken} from 'async-injection';
import {OpenAPIV3_1} from 'openapi-types';
import {FileBasedLangNeutral, IdentifiedLangNeutral, LangNeutral} from './lang-neutral';
import {Method} from './method';

export interface Api<LANG_REF = unknown> extends LangNeutral<OpenAPIV3_1.TagObject, LANG_REF>, IdentifiedLangNeutral, FileBasedLangNeutral {
	init(doc: OpenAPIV3_1.Document, jsonPath: string, tag: OpenAPIV3_1.TagObject): void;

	readonly methods: Method[];

	addMethod(method: Method): void;
}

export const CodeGenApiToken = new InjectionToken<Api>('codegen-api');
