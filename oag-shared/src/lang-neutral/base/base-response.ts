import {OpenAPIV3_1} from 'openapi-types';
import {Model} from '../model';
import {OpenApiResponse, Response} from '../response';
import {BaseLangNeutral, MixOpenApiLangNeutral} from './base-lang-neutral';
import {BaseSettingsType} from './base-settings';

export abstract class BaseResponse<LANG_REF = unknown, MODEL_LANG_REF = unknown> extends BaseLangNeutral<LANG_REF> implements Response<LANG_REF, MODEL_LANG_REF> {
	constructor(baseSettings: BaseSettingsType) {
		super(baseSettings);
	}

	get model(): Model<MODEL_LANG_REF> {
		return this.#model;
	}

	#model: Model<MODEL_LANG_REF>;

	protected setModel(model: Model<MODEL_LANG_REF>): void {
		if (this.#model)
			throw new Error('Parameter model already set');
		this.#model = model;
	}

}

type BaseResponseConstructor<LANG_REF = unknown, MODEL_LANG_REF = unknown> = new (baseSettings: BaseSettingsType) => BaseResponse<LANG_REF, MODEL_LANG_REF>;

// @ts-ignore
export abstract class BaseOpenApiResponse<LANG_REF = unknown, MODEL_LANG_REF = unknown> extends MixOpenApiLangNeutral<OpenAPIV3_1.ResponseObject, OpenApiResponse, BaseResponseConstructor<LANG_REF, MODEL_LANG_REF>>(BaseResponse as BaseResponseConstructor<LANG_REF, MODEL_LANG_REF>) implements OpenApiResponse<LANG_REF, MODEL_LANG_REF> {
	constructor(baseSettings: BaseSettingsType) {
		super(baseSettings);
	}

	init(_doc: OpenAPIV3_1.Document, _jsonPath: string, oae: OpenAPIV3_1.ResponseObject, model: Model<MODEL_LANG_REF>): this {
		this.setOae(oae);
		this.setModel(model);
		return this;
	}
}

