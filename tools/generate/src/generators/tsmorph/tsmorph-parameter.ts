import {Parameter} from 'oag-shared/lang-neutral';
import {LangNeutralApiTypes} from 'oag-shared/lang-neutral/api';
import {BaseBodyParameter, BaseNamedParameter, BaseSettingsType} from 'oag-shared/lang-neutral/base';
import {isOpenApiLangNeutral} from 'oag-shared/lang-neutral/lang-neutral';
import {ParameterKind} from 'oag-shared/lang-neutral/parameter';
import {OpenAPIV3_1} from 'openapi-types';
import {MethodSignature, ParameterDeclaration} from 'ts-morph';
import {TsMorphSettingsType} from '../../settings/tsmorph';
import {bindAst, makeJsDoc} from './oag-tsmorph';
import {MethodMethodDeclaration, MethodMethodSignature} from './tsmorph-method';
import {TsmorphModel} from './tsmorph-model';

export interface TsMorphParameter<KIND extends ParameterKind = ParameterKind> extends Parameter<KIND> {
	getLangNode(alnType: LangNeutralApiTypes): OagParameterDeclaration;

	generate(alnType: 'intf', meth: MethodMethodSignature): Promise<void>;

	generate(alnType: 'impl' | 'hndl' | 'mock', meth: MethodMethodDeclaration): Promise<void>;
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

		getLangNode(type: LangNeutralApiTypes): OagParameterDeclaration {
			return this.#tsTypes[type];
		}

		bind(alnType: LangNeutralApiTypes, ast: Omit<OagParameterDeclaration, '$ast'>): OagParameterDeclaration {
			this.#tsTypes[alnType] = bindAst(ast as any, this) as any;
			return this.#tsTypes[alnType];
		}

		generate(alnType: 'intf', meth: MethodMethodSignature): Promise<void>;
		generate(alnType: 'impl' | 'hndl' | 'mock', meth: MethodMethodDeclaration): Promise<void>;
		generate(alnType: LangNeutralApiTypes, meth: MethodMethodSignature | MethodMethodDeclaration): Promise<void>;
		async generate(alnType: LangNeutralApiTypes, meth: MethodMethodSignature | MethodMethodDeclaration): Promise<void> {
			if (!this.getLangNode(alnType)) {
				const id = this.getIdentifier(alnType);
				let param: OagParameterDeclaration = meth.getParameter(id);
				if (!param) {
					param = this.createTsParameter(alnType, meth, id, this.model);
					if (this.baseSettings.emitDescriptions) {
						if (alnType === 'intf' && isOpenApiLangNeutral<OpenAPIV3_1.ParameterBaseObject, Parameter>(this)) {
							const docs = makeJsDoc(this.oae);
							if (docs)
								console.log('ADD JSDOC');
						}
					}
				}
				if (param && !param.$ast)
					this.bind(alnType, param);
			}
		}

		protected createTsParameter(alnType: LangNeutralApiTypes, owner: MethodSignature | MethodMethodDeclaration, id: string, model: TsmorphModel) {
			const retVal = owner.addParameter({
				name: id,
				hasQuestionToken: !this.required,
				type: model.getTypeNode().getText()
			});
			return this.bind(alnType, retVal);
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
