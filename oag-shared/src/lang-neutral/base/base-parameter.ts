// noinspection TypeScriptAbstractClassConstructorCanBeMadeProtected

import {OpenAPIV3_1} from 'openapi-types';
import {LangNeutralApiTypes} from '../api';
import {Model} from '../model';
import {BodyParameter, NamedParameter, Parameter, ParameterKind} from '../parameter';
import {BaseLangNeutral, MixOpenApiLangNeutral} from './base-lang-neutral';
import {BaseSettingsType} from './base-settings';

abstract class BaseParameter<LANG_REF extends any = unknown, KIND extends ParameterKind = ParameterKind, MODEL_LANG_REF = unknown> extends BaseLangNeutral<LANG_REF> implements Parameter<LANG_REF, KIND, MODEL_LANG_REF> {
	abstract readonly name: string;
	abstract readonly required?: boolean;

	constructor(baseSettings: BaseSettingsType, readonly kind: KIND) {
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

	getIdentifier(_type: LangNeutralApiTypes): string {
		return this.toParameterName(this.name);
	}
}

type BaseParameterConstructor<LANG_REF = unknown, KIND extends ParameterKind = ParameterKind, MODEL_LANG_REF = unknown> = new (baseSettings: BaseSettingsType, kind: KIND) => BaseParameter<LANG_REF, KIND, MODEL_LANG_REF>;

// @ts-ignore
export abstract class BaseNamedParameter<LANG_REF extends any = unknown, MODEL_LANG_REF = unknown> extends MixOpenApiLangNeutral<OpenAPIV3_1.ParameterObject, NamedParameter, BaseParameterConstructor<LANG_REF, 'named', MODEL_LANG_REF>>(BaseParameter as BaseParameterConstructor<LANG_REF, 'named', MODEL_LANG_REF>) implements NamedParameter<LANG_REF, MODEL_LANG_REF> {
	constructor(baseSettings: BaseSettingsType) {
		super(baseSettings, 'named');
	}

	init(_doc: OpenAPIV3_1.Document, _jsonPath: string, oae: OpenAPIV3_1.ParameterObject, model: Model<MODEL_LANG_REF>): this {
		this.setOae(oae);
		this.setModel(model);
		return this;
	}

	get name(): string {
		const oae = this.oae;
		return oae.name;
	}

	get required(): boolean {
		const oae = this.oae;
		return oae.required;
	}
}

// @ts-ignore
export abstract class BaseBodyParameter<LANG_REF extends any = unknown, MODEL_LANG_REF = unknown> extends MixOpenApiLangNeutral<OpenAPIV3_1.RequestBodyObject, BodyParameter, BaseParameterConstructor<LANG_REF, 'body', MODEL_LANG_REF>>(BaseParameter as BaseParameterConstructor<LANG_REF, 'body', MODEL_LANG_REF>) implements BodyParameter<LANG_REF, MODEL_LANG_REF> {
	constructor(baseSettings: BaseSettingsType) {
		super(baseSettings, 'body');
	}

	init(_doc: OpenAPIV3_1.Document, _jsonPath: string, oae: OpenAPIV3_1.RequestBodyObject, model: Model<MODEL_LANG_REF>, paramNames?: string[], preferredMT?: string[]): this {
		this.setOae(oae);
		this.setModel(model);
		this.#preferredMT = preferredMT;
		this.#name = this.baseSettings.reqArgBodyNames.find(bodyName => !paramNames!.find(n => n === bodyName));
		if ((oae as any)['x-body-name'])
			this.#name = (oae as any)['x-body-name'];
		return this;
	}

	get name(): string {
		return this.#name;
	}

	#name: string;

	get required(): boolean {
		const oae = this.oae;
		return oae.required;
	}

	get preferredMediaTypes(): string[] | undefined {
		return this.#preferredMT.slice();
	}

	#preferredMT: string[];
}
