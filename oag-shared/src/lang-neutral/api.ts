import {InjectionToken} from 'async-injection';
import {OpenAPIV3_1} from 'openapi-types';
import {FileBasedLangNeutral, IdentifiedLangNeutral, LangNeutral, LangNeutralTypes, OpenApiLangNeutral} from './lang-neutral';
import {Method} from './method';

export type LangNeutralApiTypes = Extract<LangNeutralTypes, 'intf' | 'impl' | 'hndl'>;

interface ApiT<LANG_REF = unknown> extends LangNeutral<LANG_REF>, IdentifiedLangNeutral, FileBasedLangNeutral {
	readonly methods: Method[];
}

export interface Api<LANG_REF = unknown> extends ApiT<LANG_REF>, OpenApiLangNeutral<OpenAPIV3_1.TagObject, ApiT> {
}

export const CodeGenApiToken = new InjectionToken<Api>('codegen-api');
