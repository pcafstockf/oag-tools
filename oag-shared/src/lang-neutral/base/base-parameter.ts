// noinspection TypeScriptAbstractClassConstructorCanBeMadeProtected

import {OpenAPIV3_1} from 'openapi-types';
import {LangNeutralApiTypes} from '../api';
import {Model} from '../model';
import {BodyParameter, NamedParameter, Parameter, ParameterKind} from '../parameter';
import {BaseSettingsType} from '../settings';
import {BaseLangNeutral, MixOpenApiLangNeutral} from './base-lang-neutral';

abstract class BaseParameter<KIND extends ParameterKind = ParameterKind> extends BaseLangNeutral implements Parameter<KIND> {
	abstract readonly name: string;
	abstract readonly required?: boolean;

	constructor(baseSettings: BaseSettingsType, readonly kind: KIND) {
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

	getIdentifier(_type: LangNeutralApiTypes): string {
		return this.toParameterName(this.name);
	}
}

type BaseParameterConstructor<KIND extends ParameterKind = ParameterKind> = new (baseSettings: BaseSettingsType, kind: KIND) => BaseParameter<KIND>;

export abstract class BaseNamedParameter extends MixOpenApiLangNeutral<OpenAPIV3_1.ParameterObject, NamedParameter, BaseParameterConstructor<'named'>>(BaseParameter as BaseParameterConstructor<'named'>) implements NamedParameter {
	constructor(baseSettings: BaseSettingsType) {
		super(baseSettings, 'named');
	}

	init(_doc: OpenAPIV3_1.Document, _jsonPath: string, oae: OpenAPIV3_1.ParameterObject, model: Model): this {
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

export abstract class BaseBodyParameter extends MixOpenApiLangNeutral<OpenAPIV3_1.RequestBodyObject, BodyParameter, BaseParameterConstructor<'body'>>(BaseParameter as BaseParameterConstructor<'body'>) implements BodyParameter {
	constructor(baseSettings: BaseSettingsType) {
		super(baseSettings, 'body');
	}

	init(_doc: OpenAPIV3_1.Document, _jsonPath: string, oae: OpenAPIV3_1.RequestBodyObject, model: Model, paramNames?: string[], preferredMT?: string[]): this {
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
