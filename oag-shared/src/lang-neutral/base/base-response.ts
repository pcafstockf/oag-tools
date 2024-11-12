import {OpenAPIV3_1} from 'openapi-types';
import {Model} from '../model';
import {OpenApiResponse, Response} from '../response';
import {BaseSettingsType} from '../settings';
import {BaseLangNeutral, MixOpenApiLangNeutral} from './base-lang-neutral';

export abstract class BaseResponse extends BaseLangNeutral implements Response {
	// noinspection TypeScriptAbstractClassConstructorCanBeMadeProtected
	constructor(baseSettings: BaseSettingsType) {
		super(baseSettings);
	}

	get model(): Model {
		return this.#model;
	}

	#model: Model;

	protected setModel(model: Model): void {
		if (this.#model)
			throw new Error('Parameter model already set');
		this.#model = model;
	}

}

type BaseResponseConstructor = new (baseSettings: BaseSettingsType) => BaseResponse;

export abstract class BaseOpenApiResponse extends MixOpenApiLangNeutral<OpenAPIV3_1.ResponseObject, OpenApiResponse, BaseResponseConstructor>(BaseResponse as BaseResponseConstructor) implements OpenApiResponse {
	// noinspection TypeScriptAbstractClassConstructorCanBeMadeProtected
	constructor(baseSettings: BaseSettingsType) {
		super(baseSettings);
	}

	init(_doc: OpenAPIV3_1.Document, _jsonPath: string, oae: OpenAPIV3_1.ResponseObject, model: Model): this {
		this.setOae(oae);
		this.setModel(model);
		return this;
	}
}

