// noinspection TypeScriptAbstractClassConstructorCanBeMadeProtected

import {OpenAPIV3_1} from 'openapi-types';
import {OpenApiParameterStyle} from '../../utils/openapi-utils';
import {LangNeutralApiTypes} from '../api';
import {Model} from '../model';
import {BodyParameter, NamedParameter, Parameter, ParameterKind} from '../parameter';
import {BaseSettingsType} from '../settings';
import {BaseLangNeutral, MixOpenApiLangNeutral} from './base-lang-neutral';

export abstract class BaseParameter<KIND extends ParameterKind = ParameterKind> extends BaseLangNeutral implements Parameter<KIND> {
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

export class BaseNamedParameter extends MixOpenApiLangNeutral<OpenAPIV3_1.ParameterObject, NamedParameter, BaseParameterConstructor<'named'>>(BaseParameter as BaseParameterConstructor<'named'>) implements NamedParameter {
	constructor(baseSettings: BaseSettingsType) {
		super(baseSettings, 'named');
	}

	jsonPath: string;

	init(_doc: OpenAPIV3_1.Document, jsonPath: string, oae: OpenAPIV3_1.ParameterObject, model: Model): this {
		this.setOae(oae);
		this.jsonPath = jsonPath;
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

	get serializerKey() {
		const oae = this.oae;
		let s = oae.style as OpenApiParameterStyle;
		let e = oae.explode;
		if (!s) {
			switch (oae.in) {
				case 'query':
				case 'cookie':
					s = 'form';
					if (typeof e === 'undefined')
						e = true;
					break;
				case 'header':
				case 'path':
					s = 'simple';
					if (typeof e === 'undefined')
						e = false;
					break;
			}
		}
		switch (s) {
			case 'matrix':
				return `m${e ? 'e' : ''}`;
			case 'label':
				return `l${e ? 'e' : ''}`;
			case 'form':
				return `f${e ? 'e' : ''}`;
			case 'simple':
				return `s${e ? 'e' : ''}`;
			case 'spaceDelimited':
				return `sd${e ? 'e' : ''}`;
			case 'pipeDelimited':
				return `pd${e ? 'e' : ''}`;
			case 'deepObject':
				if (typeof e === 'undefined' || e)
					return `do`;    // Can only be true (defaults to true).
				return undefined;
			default:
				return undefined;
		}
	}
}

export class BaseBodyParameter extends MixOpenApiLangNeutral<OpenAPIV3_1.RequestBodyObject, BodyParameter, BaseParameterConstructor<'body'>>(BaseParameter as BaseParameterConstructor<'body'>) implements BodyParameter {
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
		return this.#preferredMT?.slice();
	}

	#preferredMT: string[];
}
