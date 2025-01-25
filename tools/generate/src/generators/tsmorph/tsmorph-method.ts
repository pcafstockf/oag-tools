import {LangNeutralApiTypes} from 'oag-shared/lang-neutral/api';
import {BaseMethod, BaseSettingsType, Method} from 'oag-shared/lang-neutral/base';
import {Identifier, MethodDeclaration, MethodSignature} from 'ts-morph';
import {TsMorphSettingsType} from '../../settings/tsmorph';
import {bindAst} from './oag-tsmorph';
import {ApiInterfaceDeclaration, TsmorphApi} from './tsmorph-api';
import {TsmorphModel} from './tsmorph-model';
import {isTsmorphParameter} from './tsmorph-parameter';
import {isTsmorphResponse} from './tsmorph-response';

export interface TsmorphMethod extends Method {
	getLangNode(type: 'intf'): MethodMethodSignature;

	getLangNode(type: 'impl'): MethodMethodDeclaration;

	getLangNode(type: 'hndl'): MethodMethodDeclaration;

	getLangNode(type: 'mock'): MethodMethodDeclaration;

	getTypeNode(ln?: Readonly<MethodMethodSignature | MethodMethodDeclaration>): Identifier & { readonly $ast: TsmorphModel };

	generate(api: TsmorphApi): Promise<void>;
}

export abstract class BaseTsmorphMethod extends BaseMethod implements TsmorphMethod {
	protected constructor(baseSettings: BaseSettingsType, protected readonly tsMorphSettings: TsMorphSettingsType) {
		super(baseSettings);
		this.#tsTypes = {} as any;
	}

	readonly #tsTypes: {
		intf: MethodMethodSignature,
		impl: MethodMethodDeclaration,
		hndl: MethodMethodDeclaration
		mock: MethodMethodDeclaration
	};

	getTypeNode(ln?: Readonly<MethodMethodSignature | MethodMethodDeclaration>): Identifier & { readonly $ast: TsmorphModel } {
		throw new Error('Bad internal logic');
	}

	getLangNode(type: 'intf'): MethodMethodSignature;
	getLangNode(type: 'impl'): MethodMethodDeclaration;
	getLangNode(type: 'hndl'): MethodMethodDeclaration;
	getLangNode(type: 'mock'): MethodMethodDeclaration;
	getLangNode(type: LangNeutralApiTypes): MethodMethodSignature | MethodMethodDeclaration {
		return this.#tsTypes[type];
	}

	bind(alnType: 'intf', ast: Omit<MethodMethodSignature, '$ast'>): MethodMethodSignature;
	bind(alnType: 'impl', ast: Omit<MethodMethodDeclaration, '$ast'>): MethodMethodDeclaration;
	bind(alnType: 'hndl', ast: Omit<MethodMethodDeclaration, '$ast'>): MethodMethodDeclaration;
	bind(alnType: 'mock', ast: Omit<MethodMethodDeclaration, '$ast'>): MethodMethodDeclaration;
	bind(alnType: LangNeutralApiTypes, ast: Omit<MethodMethodSignature, '$ast'> | Omit<MethodMethodDeclaration, '$ast'>): MethodMethodSignature | MethodMethodDeclaration {
		this.#tsTypes[alnType] = bindAst(ast as any, this) as any;
		return this.#tsTypes[alnType];
	}

	protected ensureIdentifier(type: LangNeutralApiTypes) {
		let identifier = this.getIdentifier(type);
		if (identifier) {
			// If we are not generating for this type, then by definition, the identifier is fake.
			switch (type) {
				case 'intf':
					if (isTsmorphMethod(this))
						if (this.baseSettings.apiIntfDir)
							return identifier;
					break;
				case 'impl':
					if (isTsmorphMethod(this))
						if (this.baseSettings.apiImplDir)
							return identifier;
					break;
				case 'hndl':
					if (isTsmorphMethod(this))
						if (this.baseSettings.apiHndlDir)
							return identifier;
					break;
				case 'mock':
					if (isTsmorphMethod(this))
						if (this.baseSettings.apiMockDir)
							return identifier;
					break;
				default:
					break;
			}
			return undefined;
		}
	}


	async generate(api: TsmorphApi): Promise<void> {
		let apiDecl = api.getLangNode('intf');
		if (apiDecl && !this.getLangNode('intf')) {
			const id = this.ensureIdentifier('intf');
			let retVal: MethodMethodSignature = apiDecl.getMethod(id);
			if (!retVal) {
				this.bind('intf', this.createMethodSignature(apiDecl, id));
			}
			else if (!retVal.$ast)
				this.bind('intf', retVal);
		}
		for (let p of this.parameters)
			if (isTsmorphParameter(p))
				await p.generate(this);
		for (let [code, rsp] of this.responses)
			if (isTsmorphResponse(rsp))
				await rsp.generate(this, code);
	}

	protected createMethodSignature(owner: ApiInterfaceDeclaration, id: string) {
		let retVal = owner.addMethod({
			name: id
		});
		return retVal;
	}
}

export function isTsmorphMethod(obj: any): obj is TsmorphMethod {
	if (obj)
		if (obj instanceof BaseTsmorphMethod)
			return true;
	return false;
}

interface MethodMethodSignature extends MethodSignature {
	readonly $ast?: BaseTsmorphMethod;
}

interface MethodMethodDeclaration extends MethodDeclaration {
	readonly $ast?: BaseTsmorphMethod;
}
