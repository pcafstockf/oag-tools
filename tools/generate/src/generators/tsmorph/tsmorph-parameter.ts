import {Parameter} from 'oag-shared/lang-neutral';
import {LangNeutralApiTypes} from 'oag-shared/lang-neutral/api';
import {BaseBodyParameter, BaseNamedParameter, BaseParameter, BaseSettingsType} from 'oag-shared/lang-neutral/base';
import {BodyParameter, NamedParameter, ParameterKind} from 'oag-shared/lang-neutral/parameter';
import {ParameterDeclaration} from 'ts-morph';
import {TsMorphSettingsType} from '../../settings/tsmorph';
import {TsmorphModel} from './tsmorph-model';

export interface TsMorphParameter<KIND extends ParameterKind = ParameterKind> extends Parameter<KIND> {
	model: TsmorphModel;

	getLangNode(alnType: LangNeutralApiTypes): OagParameterDeclaration;
}

function MixTsMorphParameter<T extends BaseParameter>(base: any) {
	//@ts-ignore
	const derived = class extends base implements TsMorphParameter {
		constructor(baseSettings: BaseSettingsType, protected readonly tsMorphSettings: TsMorphSettingsType) {
			super(baseSettings);
		}

		readonly #tsTypes: {
			intf: OagParameterDeclaration,
			impl: OagParameterDeclaration,
			hndl: OagParameterDeclaration
			mock: OagParameterDeclaration
		};

		getLangNode(type: LangNeutralApiTypes): OagParameterDeclaration {
			return this.#tsTypes[type];
		}
	};
	return derived as new (baseSettings: BaseSettingsType, tsMorphSettings: TsMorphSettingsType) => typeof derived.prototype & TsMorphParameter & T;
}

export class TsmorphNamedParameter extends MixTsMorphParameter<BaseNamedParameter>(BaseNamedParameter) implements NamedParameter, TsMorphParameter<'named'> {
	constructor(
		baseSettings: BaseSettingsType,
		tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, tsMorphSettings);
	}
}

export class TsmorphBodyParameter extends MixTsMorphParameter<BaseBodyParameter>(BaseBodyParameter) implements BodyParameter, TsMorphParameter<'body'> {
	constructor(
		baseSettings: BaseSettingsType,
		tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, tsMorphSettings);
	}
}

export function isTsmorphParameter(obj: any): obj is TsmorphNamedParameter | TsmorphBodyParameter {
	if (obj)
		if (obj instanceof TsmorphNamedParameter || obj instanceof TsmorphBodyParameter)
			return true;
	return false;
}

interface OagParameterDeclaration extends ParameterDeclaration {
	readonly $ast?: Parameter;
}
