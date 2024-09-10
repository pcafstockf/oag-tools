import {InjectionToken} from 'async-injection';
import {OpenAPIV3_1} from 'openapi-types';
import {BaseIdentifiedLangNeutral} from './base-lang-neutral';
import {BaseSettingsType} from './base-settings';
import {Model} from './model';
import {AbsParameter, BodyParameter, CodeGenBodyParameterToken, CodeGenNamedParameterToken, NamedParameter} from './parameter';

export abstract class BaseParameter<OAE, LANG_REF extends any = unknown, MODEL_LANG_REF = unknown> extends BaseIdentifiedLangNeutral<OAE, LANG_REF> implements AbsParameter<OAE, LANG_REF, MODEL_LANG_REF> {
	abstract readonly kind: 'param' | 'body';
	abstract readonly required?: boolean;

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

	getType(type: 'intf' | 'impl' | 'hndl'): LANG_REF {
		// Has to be concrete in order to support mixins further down the chain.
		throw new Error('Method not implemented.');
	}
}

export class BaseNamedParameter<LANG_REF extends any = unknown, MODEL_LANG_REF = unknown> extends BaseParameter<OpenAPIV3_1.ParameterObject, LANG_REF, MODEL_LANG_REF> implements NamedParameter<LANG_REF, MODEL_LANG_REF> {
	readonly kind = 'param';

	constructor(baseSettings: BaseSettingsType) {
		super(baseSettings);
	}

	get required(): boolean {
		const oae = this.oae;
		return oae.required;
	}

	getIdentifier(_type: string): string {
		return this.toParameterName(this.oae.name);
	}
}

export const BaseNamedParameterToken = CodeGenNamedParameterToken as InjectionToken<BaseNamedParameter>;

export class BaseBodyParameter<LANG_REF extends any = unknown, MODEL_LANG_REF = unknown> extends BaseParameter<OpenAPIV3_1.RequestBodyObject, LANG_REF, MODEL_LANG_REF> implements BodyParameter<LANG_REF, MODEL_LANG_REF> {
	readonly kind = 'body';

	constructor(baseSettings: BaseSettingsType) {
		super(baseSettings);
	}

	/**
	 * @inheritDoc
	 * WARNING:
	 *  Even though 'params' is declared as optional (to keep TypeScript happy wrt inheritance), it is not optional.
	 */
	init(doc: OpenAPIV3_1.Document, jsonPath: string, oae: OpenAPIV3_1.RequestBodyObject, paramNames?: string[], preferredMT?: string[]): void {
		super.init(doc, jsonPath, oae);
		this.#preferredMT = preferredMT;
		this.#paramName = this.baseSettings.reqArgBodyNames.find(bodyName => !paramNames!.find(n => n === bodyName));
		if ((oae as any)['x-body-name'])
			this.#paramName = (oae as any)['x-body-name'];
	}

	#paramName: string;

	get required(): boolean {
		const oae = this.oae;
		return oae.required;
	}

	getIdentifier(_type: string): string {
		return this.toParameterName(this.#paramName);
	}

	get preferredMediaTypes(): string[] | undefined {
		return this.#preferredMT.slice();
	}

	#preferredMT: string[];
}

export const BaseBodyParameterToken = CodeGenBodyParameterToken as InjectionToken<BaseBodyParameter>;
