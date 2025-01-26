import {LangNeutralApiTypes} from 'oag-shared/lang-neutral/api';
import {BaseMethod, BaseSettingsType, Method} from 'oag-shared/lang-neutral/base';
import {isOpenApiLangNeutral} from 'oag-shared/lang-neutral/lang-neutral';
import {OpenAPIV3_1} from 'openapi-types';
import {Identifier, MethodDeclaration, MethodSignature} from 'ts-morph';
import {TsMorphSettingsType} from '../../settings/tsmorph';
import {bindAst, makeJsDoc} from './oag-tsmorph';
import {ApiClassDeclaration, ApiInterfaceDeclaration} from './tsmorph-api';
import {TsmorphModel} from './tsmorph-model';
import {isTsmorphParameter} from './tsmorph-parameter';
import {isTsmorphResponse} from './tsmorph-response';

export interface TsmorphMethod extends Method {
	getLangNode(type: 'intf'): MethodMethodSignature;

	getLangNode(type: 'impl' | 'hndl' | 'mock'): MethodMethodDeclaration;

	getTypeNode(ln?: Readonly<MethodMethodSignature | MethodMethodDeclaration>): Identifier & { readonly $ast: TsmorphModel };

	generate(alnType: 'intf', api: ApiInterfaceDeclaration): Promise<MethodMethodSignature[]>;

	generate(alnType: 'impl' | 'hndl' | 'mock', api: ApiClassDeclaration): Promise<(MethodMethodSignature | MethodMethodDeclaration)[]>;
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
	getLangNode(type: 'impl' | 'hndl' | 'mock'): MethodMethodDeclaration;
	getLangNode(type: LangNeutralApiTypes): MethodMethodSignature | MethodMethodDeclaration;
	override getLangNode(type: LangNeutralApiTypes): MethodMethodSignature | MethodMethodDeclaration {
		return this.#tsTypes[type];
	}

	bind(alnType: 'intf', ast: Omit<MethodMethodSignature, '$ast'>): MethodMethodSignature;
	bind(alnType: 'impl' | 'hndl' | 'mock', ast: Omit<MethodMethodDeclaration, '$ast'>): MethodMethodDeclaration;
	bind(alnType: LangNeutralApiTypes, ast: Omit<MethodMethodSignature, '$ast'> | Omit<MethodMethodDeclaration, '$ast'>): MethodMethodSignature | MethodMethodDeclaration;
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

	async generate(alnType: 'intf', api: ApiInterfaceDeclaration): Promise<MethodMethodSignature[]>;
	async generate(alnType: 'impl' | 'hndl' | 'mock', api: ApiClassDeclaration): Promise<(MethodMethodSignature | MethodMethodDeclaration)[]>;
	async generate(alnType: LangNeutralApiTypes, api: ApiInterfaceDeclaration | ApiClassDeclaration): Promise<(MethodMethodSignature | MethodMethodDeclaration)[]> {
		if (!this.getLangNode(alnType)) {
			const id = this.ensureIdentifier(alnType);
			let meth = api.getMethod(id) as MethodMethodSignature | MethodMethodDeclaration;
			if (!meth) {
				meth = this.createTsMethod(alnType, api, id);
				if (this.baseSettings.emitDescriptions) {
					if (alnType === 'intf' && isOpenApiLangNeutral<OpenAPIV3_1.OperationObject, Method>(this)) {
						const docs = makeJsDoc(this.oae);
						if (docs)
							meth.addJsDoc(docs);
					}
				}
			}
			if (meth && !meth.$ast)
				meth = this.bind(alnType, meth);
			for (let p of this.parameters)
				if (isTsmorphParameter(p)) {
					if (alnType === 'intf')
						await p.generate(alnType, meth as MethodMethodSignature);
					else
						await p.generate(alnType, meth as MethodMethodDeclaration);
				}
			for (let [code, rsp] of this.responses)
				if (isTsmorphResponse(rsp)) {
					if (alnType === 'intf')
						await rsp.generate(alnType, meth as MethodMethodSignature, code);
					else
						await rsp.generate(alnType, meth as MethodMethodDeclaration, code);
				}
			return [meth];
		}
		return [];
	}

	protected createTsMethod(alnType: LangNeutralApiTypes, owner: ApiInterfaceDeclaration | ApiClassDeclaration, id: string) {
		let retVal = owner.addMethod({
			name: id
		});
		return this.bind(alnType, retVal);
	}
}

export function isTsmorphMethod(obj: any): obj is TsmorphMethod {
	if (obj)
		if (obj instanceof BaseTsmorphMethod)
			return true;
	return false;
}

export interface MethodMethodSignature extends MethodSignature {
	readonly $ast?: BaseTsmorphMethod;
	readonly $next?: MethodMethodSignature | MethodMethodDeclaration;
}

export interface MethodMethodDeclaration extends MethodDeclaration {
	readonly $ast?: BaseTsmorphMethod;
}
