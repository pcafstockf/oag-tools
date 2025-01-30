import os from 'node:os';
import {LangNeutralApiTypes} from 'oag-shared/lang-neutral/api';
import {BaseMethod, BaseSettingsType, Method, Model, Parameter} from 'oag-shared/lang-neutral/base';
import {isIdentifiedLangNeutral, isOpenApiLangNeutral} from 'oag-shared/lang-neutral/lang-neutral';
import {isArrayModel} from 'oag-shared/lang-neutral/model';
import {OpenAPIV3_1} from 'openapi-types';
import {JSDocTagStructure, MethodDeclaration, MethodSignature, StructureKind} from 'ts-morph';
import {TsMorphSettingsType} from '../../settings/tsmorph';
import {bindAst, makeJsDoc, makeJsDocTxt} from './oag-tsmorph';
import {ApiClassDeclaration, ApiInterfaceDeclaration} from './tsmorph-api';
import {isTsmorphParameter, TsMorphParameter} from './tsmorph-parameter';
import {isTsmorphResponse, TsmorphResponse} from './tsmorph-response';

export interface TsmorphMethod extends Method {
	generate(alnType: 'intf', api: ApiInterfaceDeclaration): Promise<MethodMethodSignature>;

	generate(alnType: 'impl' | 'hndl' | 'mock', api: ApiClassDeclaration): Promise<MethodMethodDeclaration>;
}

export abstract class BaseTsmorphMethod extends BaseMethod implements TsmorphMethod {
	protected constructor(baseSettings: BaseSettingsType, protected readonly tsMorphSettings: TsMorphSettingsType) {
		super(baseSettings);
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

	protected makeJsDoc(params: TsMorphParameter[], responses: Map<string, TsmorphResponse>) {
		if (isTsmorphMethod(this)) {
			return makeJsDoc(this.oae, (docs) => {
				const makeDescFn = (outer: Model) => {
					let desc: string;
					const computeModelDesc = (inner: Model) => {
						if (isOpenApiLangNeutral<OpenAPIV3_1.BaseSchemaObject, Model>(inner) && inner.oae.description)
							return inner.oae.description;
						else if (isIdentifiedLangNeutral(inner) && inner.getIdentifier('intf'))
							return '@see ' + inner.getIdentifier('intf');
						return '';
					};
					if (isArrayModel(outer)) {
						desc = computeModelDesc(outer.items);
						if (desc)
							desc += '[]';
					}
					if (!desc)
						desc = computeModelDesc(outer);
					return desc;
				};
				params.forEach(p => {
					if (isOpenApiLangNeutral<OpenAPIV3_1.ParameterBaseObject, Parameter>(p)) {
						let jsTxt = makeJsDocTxt('summary' in p.oae ? p.oae.summary as string : undefined, p.oae.description);
						const jsTxts: string[] = [];
						const desc = makeDescFn(p.model);
						if (desc)
							jsTxts.push(desc);
						if ((!jsTxt) && jsTxts.length > 0)
							jsTxt = jsTxts.join(os.EOL);
						const jsDoc = <JSDocTagStructure>{
							kind: StructureKind.JSDocTag,
							tagName: 'param',
							text: p.getIdentifier('intf') + (jsTxt ? '\t' + jsTxt : '')
						};
						if (!Array.isArray(docs.tags))
							docs.tags = [];
						docs.tags.push(jsDoc);
					}
				});
				let returnDoc = [] as string [];
				let throwsDoc = [] as string [];
				responses.forEach((v, k) => {
					const desc = makeDescFn(v.model);
					if (desc) {
						if (k.startsWith('2') || k.startsWith('d') || k.startsWith('D'))
							returnDoc.push(desc);
						else
							throwsDoc.push(`${k}: ${desc}`);
					}
				});
				if (returnDoc.length > 0) {
					if (returnDoc.length > 1)
						returnDoc = returnDoc.map(e => '- ' + e);
					if (!Array.isArray(docs.tags))
						docs.tags = [];
					docs.tags.push({
						kind: StructureKind.JSDocTag,
						tagName: 'returns',
						text: returnDoc.join(os.EOL)
					});
				}
				if (throwsDoc.length > 0) {
					throwsDoc = throwsDoc.map(e => '- ' + e);
					throwsDoc.unshift('{Error}' + os.EOL);
					if (!Array.isArray(docs.tags))
						docs.tags = [];
					docs.tags.push({
						kind: StructureKind.JSDocTag,
						tagName: 'throws',
						text: throwsDoc.join(os.EOL)
					});
				}
			});
		}
		return undefined;
	}

	async generate(alnType: 'intf', api: ApiInterfaceDeclaration): Promise<MethodMethodSignature>;
	async generate(alnType: 'impl' | 'hndl' | 'mock', api: ApiClassDeclaration): Promise<MethodMethodDeclaration>;
	async generate(alnType: LangNeutralApiTypes, api: ApiInterfaceDeclaration | ApiClassDeclaration): Promise<MethodMethodSignature | MethodMethodDeclaration> {
		const id = this.ensureIdentifier(alnType);
		let meth = api.getMethod(id) as MethodMethodSignature | MethodMethodDeclaration;
		if (!meth) {
			const params = this.parameters.filter(p => isTsmorphParameter(p)) as TsMorphParameter[];
			const responses = Array.from(this.responses.keys()).reduce((p, key) => {
				const r = this.responses.get(key);
				if (isTsmorphResponse(r))
					p.set(key, r);
				return p;
			}, new Map<string, TsmorphResponse>());
			meth = await this.createTsMethod(alnType, api, id, params, responses);
			if (this.baseSettings.emitDescriptions) {
				if (alnType === 'intf' && isOpenApiLangNeutral<OpenAPIV3_1.OperationObject, Method>(this)) {
					const docs = this.makeJsDoc(params, responses);
					if (docs)
						meth.addJsDoc(docs);
				}
			}
		}
		if (meth && !meth.$ast)
			meth = bindAst(meth, this);
		return meth;
	}

	/**
	 * Subclasses should override.
	 * They may generate anything they like, but the returned method will be the one the JSDoc is attached to.
	 */
	protected async createTsMethod(alnType: LangNeutralApiTypes, owner: ApiInterfaceDeclaration | ApiClassDeclaration, id: string, params: TsMorphParameter[], responses: Map<string, TsmorphResponse>): Promise<MethodMethodSignature | MethodMethodDeclaration> {
		return owner.addMethod({
			name: id
		});
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
