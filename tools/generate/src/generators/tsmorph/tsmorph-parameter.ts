import {ParameterDeclaration} from 'ts-morph';
import {BaseSettingsType} from '../../settings/base';
import {TsMorphSettingsType} from '../../settings/tsmorph';
import {BaseBodyParameter, BaseNamedParameter} from '../base-parameter';


interface NamedParameterDeclaration extends ParameterDeclaration {
	readonly $ast: TsmorphNamedParameter;
}

interface BodyParameterDeclaration extends ParameterDeclaration {
	readonly $ast: TsmorphBodyParameter;
}

type BaseParamConstructor = new (...args: any[]) => {};

function MixinTsMorphParameter<T extends ParameterDeclaration, TBase extends BaseParamConstructor>(Base: TBase) {
	return class TsmorphParams extends Base {
		protected tsMorphSettings: TsMorphSettingsType;

		getType(type: 'intf'): T;
		getType(type: 'impl'): T;
		getType(type: 'hndl'): T;
		getType(type: string): T {
			return this.#tsTypes[type];
		}

		#tsTypes: Record<string, T>;
	};
}

export class TsmorphNamedParameter extends MixinTsMorphParameter<NamedParameterDeclaration, typeof BaseNamedParameter>(BaseNamedParameter) {
	constructor(
		baseSettings: BaseSettingsType,
		tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings);
		this.tsMorphSettings = tsMorphSettings;
	}
}

export class TsmorphBodyParameter extends MixinTsMorphParameter<BodyParameterDeclaration, typeof BaseBodyParameter>(BaseBodyParameter) {
	constructor(
		baseSettings: BaseSettingsType,
		tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings);
		this.tsMorphSettings = tsMorphSettings;
	}
}
