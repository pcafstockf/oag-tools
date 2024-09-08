import {InjectionToken} from 'async-injection';
import {CodeGenResponseToken, Model, Response} from 'oag-shared/lang-neutral';
import {OpenAPIV3_1} from 'openapi-types';
import {BaseSettingsType} from '../settings/base';
import {BaseLangNeutral} from './base-lang-neutral';

export abstract class BaseResponse<LANG_REF = unknown, MODEL_LANG_REF = unknown> extends BaseLangNeutral<OpenAPIV3_1.ResponseObject> implements Response<LANG_REF, MODEL_LANG_REF> {
	protected constructor(baseSettings: BaseSettingsType) {
		super(baseSettings);
	}

	get model(): Model<MODEL_LANG_REF> {
		return this.#model;
	}

	setModel(model: Model<MODEL_LANG_REF>): void {
		if (this.#model)
			throw new Error('Parameter model already set');
		this.#model = model;
	}

	#model: Model<MODEL_LANG_REF>;

	abstract getType(type: 'intf' | 'impl' | 'hndl'): LANG_REF;
}

export const BaseResponseToken = CodeGenResponseToken as InjectionToken<BaseResponse>;
