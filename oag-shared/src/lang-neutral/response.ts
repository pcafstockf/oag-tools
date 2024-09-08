import {InjectionToken} from 'async-injection';
import {OpenAPIV3_1} from 'openapi-types';
import {LangNeutral} from './lang-neutral';
import {Model} from './model';

export interface Response<LANG_REF = unknown, MODEL_LANG_REF = unknown> extends LangNeutral<OpenAPIV3_1.ResponseObject, LANG_REF> {
	readonly model: Model<MODEL_LANG_REF>;
}

export const CodeGenResponseToken = new InjectionToken<Response>('codegen-response');
