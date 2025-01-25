import {Parameter} from 'oag-shared/lang-neutral';
import {LangNeutralApiTypes} from 'oag-shared/lang-neutral/api';
import {BaseBodyParameter, BaseNamedParameter, BaseSettingsType} from 'oag-shared/lang-neutral/base';
import {ParameterKind} from 'oag-shared/lang-neutral/parameter';
import {MethodSignature, ParameterDeclaration} from 'ts-morph';
import {TsMorphSettingsType} from '../../settings/tsmorph';
import {bindAst} from './oag-tsmorph';
import {TsmorphMethod} from './tsmorph-method';
import {TsmorphModel} from './tsmorph-model';

export interface TsMorphParameter<KIND extends ParameterKind = ParameterKind> extends Parameter<KIND> {
	getLangNode(type: 'intf'): OagParameterDeclaration;

	getLangNode(type: 'impl'): OagParameterDeclaration;

	getLangNode(type: 'hndl'): OagParameterDeclaration;

	getLangNode(type: 'mock'): OagParameterDeclaration;

	generate(method: TsmorphMethod): Promise<void>;
}

function MixTsMorphParameter(base: any) {
	//@ts-ignore
	const derived = class extends base implements TsMorphParameter {
		constructor(baseSettings: BaseSettingsType, protected readonly tsMorphSettings: TsMorphSettingsType) {
			super(baseSettings);
			this.#tsTypes = {} as any;
		}

		readonly #tsTypes: {
			intf: OagParameterDeclaration,
			impl: OagParameterDeclaration,
			hndl: OagParameterDeclaration
			mock: OagParameterDeclaration
		};

		getLangNode(type: 'intf'): OagParameterDeclaration;
		getLangNode(type: 'impl'): OagParameterDeclaration;
		getLangNode(type: 'hndl'): OagParameterDeclaration;
		getLangNode(type: 'mock'): OagParameterDeclaration;
		getLangNode(type: LangNeutralApiTypes): OagParameterDeclaration {
			return this.#tsTypes[type];
		}

		bind(alnType: 'intf', ast: Omit<OagParameterDeclaration, '$ast'>): OagParameterDeclaration;
		bind(alnType: 'impl', ast: Omit<OagParameterDeclaration, '$ast'>): OagParameterDeclaration;
		bind(alnType: 'hndl', ast: Omit<OagParameterDeclaration, '$ast'>): OagParameterDeclaration;
		bind(alnType: 'mock', ast: Omit<OagParameterDeclaration, '$ast'>): OagParameterDeclaration;
		bind(alnType: LangNeutralApiTypes, ast: Omit<OagParameterDeclaration, '$ast'>): OagParameterDeclaration {
			this.#tsTypes[alnType] = bindAst(ast as any, this) as any;
			return this.#tsTypes[alnType];
		}

		async generate(method: TsmorphMethod): Promise<void> {
			const sf = method.getLangNode('intf').getSourceFile();
			await this.model.generate(sf);
			let intf = method.getLangNode('intf');
			if (intf && (!this.getLangNode('intf'))) {
				const id = this.getIdentifier('intf');
				let param: OagParameterDeclaration = intf.getParameter(id);
				if (!param)
					this.bind('intf', this.createParameter(intf, id, this.model));
				else if (!param.$ast)
					this.bind('intf', param);
				this.model.importInto(sf);
			}
		}

		protected createParameter(owner: MethodSignature, id: string, model: TsmorphModel) {
			const retVal = owner.addParameter({
				name: id,
				hasQuestionToken: !this.required,
				type: model.getTypeNode().getText()
			});
			return retVal;
		}
	};
	return derived as new (baseSettings: BaseSettingsType, tsMorphSettings: TsMorphSettingsType) => typeof derived.prototype & TsMorphParameter;
}

export class TsmorphNamedParameter extends MixTsMorphParameter(BaseNamedParameter) {
	constructor(
		baseSettings: BaseSettingsType,
		tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, tsMorphSettings);
	}
}

export class TsmorphBodyParameter extends MixTsMorphParameter(BaseBodyParameter) {
	constructor(
		baseSettings: BaseSettingsType,
		tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, tsMorphSettings);
	}
}

export function isTsmorphParameter(obj: any): obj is TsMorphParameter {
	if (obj)
		if (obj instanceof TsmorphNamedParameter || obj instanceof TsmorphBodyParameter)
			return true;
	return false;
}

interface OagParameterDeclaration extends ParameterDeclaration {
	readonly $ast?: Parameter;
}
