import {LangNeutral, LangNeutralType, Parameter} from 'oag-shared/lang-neutral';
import {BaseBodyParameter, BaseLangNeutralConstructor, BaseNamedParameter, BaseSettingsType} from 'oag-shared/lang-neutral/base';
import {ParameterDeclaration} from 'ts-morph';
import {TsMorphSettingsType} from '../../settings/tsmorph';


interface OagParameterDeclaration extends ParameterDeclaration {
	readonly $ast: Parameter;
}

type TsmorphParameterTypes = OagParameterDeclaration;

function MixTsMorphParameter<T>(base: T) {
	const derived = class TsMorphParameter extends (base as BaseLangNeutralConstructor) implements LangNeutral {
		constructor(baseSettings: BaseSettingsType, protected readonly tsMorphSettings: TsMorphSettingsType) {
			super(baseSettings);
		}

		getLangNode(type: 'intf'): OagParameterDeclaration;
		getLangNode(type: 'impl'): OagParameterDeclaration;
		getLangNode(type: 'hndl'): OagParameterDeclaration;
		override getLangNode(type: LangNeutralType): TsmorphParameterTypes {
			return this.#tsTypes[type];
		}

		#tsTypes: Record<string, TsmorphParameterTypes>;
	};
	return derived as unknown as new (baseSettings: BaseSettingsType, tsMorphSettings: TsMorphSettingsType) => T & typeof derived.prototype;
}

export class TsmorphNamedParameter extends MixTsMorphParameter<BaseNamedParameter>(BaseNamedParameter as any) {
	constructor(
		baseSettings: BaseSettingsType,
		tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, tsMorphSettings);
	}
}

export class TsmorphBodyParameter extends MixTsMorphParameter<BaseBodyParameter>(BaseBodyParameter as any) {
	constructor(
		baseSettings: BaseSettingsType,
		tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, tsMorphSettings);
	}
}
