import {LangNeutral, LangNeutralTypes, Parameter} from 'oag-shared/lang-neutral';
import {BaseLangNeutralConstructor, BaseSettingsType, BaseBodyParameter, BaseNamedParameter} from 'oag-shared/lang-neutral/base';
import {ParameterDeclaration} from 'ts-morph';
import {TsMorphSettingsType} from '../../settings/tsmorph';


interface OagParameterDeclaration extends ParameterDeclaration {
	readonly $ast: Parameter;
}

type TsmorphParameterTypes = OagParameterDeclaration;

function MixTsMorphParameter<T>(base: T) {
	const derived = class TsMorphParameter extends (base as BaseLangNeutralConstructor) implements LangNeutral<TsmorphParameterTypes> {
		constructor(baseSettings: BaseSettingsType, protected readonly tsMorphSettings: TsMorphSettingsType) {
			super(baseSettings);
		}

		getType(type: 'intf'): OagParameterDeclaration;
		getType(type: 'impl'): OagParameterDeclaration;
		getType(type: 'hndl'): OagParameterDeclaration;
		override getType(type: LangNeutralTypes): TsmorphParameterTypes {
			return this.#tsTypes[type];
		}
		#tsTypes: Record<string, TsmorphParameterTypes>;
	};
	return derived as unknown as new (baseSettings: BaseSettingsType, tsMorphSettings: TsMorphSettingsType) => T & typeof derived.prototype;
}

export class TsmorphNamedParameter extends MixTsMorphParameter<BaseNamedParameter<TsmorphParameterTypes>>(BaseNamedParameter as any) {
	constructor(
		baseSettings: BaseSettingsType,
		tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, tsMorphSettings);
	}
}

export class TsmorphBodyParameter extends MixTsMorphParameter<BaseBodyParameter<TsmorphParameterTypes>>(BaseBodyParameter as any) {
	constructor(
		baseSettings: BaseSettingsType,
		tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, tsMorphSettings);
	}
}
