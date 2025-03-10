import {InjectionToken} from 'async-injection';
import {OpenAPIV3_1} from 'openapi-types';
import {FileBasedLangNeutral, IdentifiedLangNeutral, LangNeutral, LangNeutralType, OpenApiLangNeutral} from './lang-neutral';
import {Method} from './method';

export type LangNeutralApiTypes = Extract<LangNeutralType, 'intf' | 'impl' | 'hndl' | 'mock'>;

interface ApiT extends Omit<LangNeutral, 'getLangNode'>, IdentifiedLangNeutral, FileBasedLangNeutral {
	readonly name: string;
	readonly methods: Method[];

	getLangNode(type: LangNeutralApiTypes): unknown;
}

export interface Api extends ApiT, OpenApiLangNeutral<OpenAPIV3_1.TagObject, ApiT> {
}

export const CodeGenApiToken = new InjectionToken<Api>('codegen-api');
