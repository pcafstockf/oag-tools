import os from 'node:os';
import {BaseMethod, BaseSettingsType, Method, Model, Parameter} from 'oag-shared/lang-neutral/base';
import {isIdentifiedLangNeutral, isOpenApiLangNeutral} from 'oag-shared/lang-neutral/lang-neutral';
import {isArrayModel} from 'oag-shared/lang-neutral/model';
import {OpenAPIV3_1} from 'openapi-types';
import {JSDocTagStructure, MethodDeclaration, MethodSignature, StructureKind} from 'ts-morph';
import {TsMorphSettingsType} from '../../settings/tsmorph';
import {bindAst, makeJsDoc, makeJsDocTxt} from './oag-tsmorph';
import {ApiClassDeclaration, ApiInterfaceDeclaration} from './tsmorph-api';
import {isTsmorphModel, TsmorphModel} from './tsmorph-model';
import {isTsmorphParameter, TsMorphParameter} from './tsmorph-parameter';
import {isTsmorphResponse, TsmorphResponse} from './tsmorph-response';

export interface TsMethodSignature {
	params: {
		param: TsMorphParameter
		name: string;
		required: boolean;
		typeText: string;
	}[],
	responses: Map<string, TsmorphResponse>;
	okRsp: TsmorphResponse[];
	returnText: string;
	preferredStatus: number | undefined;
}

export interface TsmorphMethod<
	AINTF extends ApiInterfaceDeclaration | ApiClassDeclaration,
	AIMPL extends ApiClassDeclaration,
	MINTF extends MethodMethodSignature | MethodMethodDeclaration,
	MIMPL extends MethodMethodDeclaration
> extends Method {
	generate(alnType: 'intf', api: AINTF): Promise<MINTF>;
	generate(alnType: 'impl', api: AIMPL): Promise<MIMPL>;

	/**
	 * Helper method to compute textual / template friendly signature.
	 */
	computeSignature(): TsMethodSignature;
}

export abstract class BaseTsmorphMethod<
	AINTF extends ApiInterfaceDeclaration | ApiClassDeclaration,
	AIMPL extends ApiClassDeclaration,
	MINTF extends MethodMethodSignature | MethodMethodDeclaration,
	MIMPL extends MethodMethodDeclaration
> extends BaseMethod implements TsmorphMethod<AINTF, AIMPL, MINTF, MIMPL> {
	protected constructor(baseSettings: BaseSettingsType, protected readonly tsMorphSettings: TsMorphSettingsType) {
		super(baseSettings);
	}

	protected makeJsDoc(sig: TsMethodSignature) {
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
				sig.params.forEach(p => {
					if (isOpenApiLangNeutral<OpenAPIV3_1.ParameterBaseObject, Parameter>(p)) {
						let jsTxt = makeJsDocTxt('summary' in p.oae ? p.oae.summary as string : undefined, p.oae.description);
						const jsTxts: string[] = [];
						const desc = makeDescFn(p.param.model);
						if (desc)
							jsTxts.push(desc);
						if ((!jsTxt) && jsTxts.length > 0)
							jsTxt = jsTxts.join(os.EOL);
						const jsDoc = <JSDocTagStructure>{
							kind: StructureKind.JSDocTag,
							tagName: 'param',
							text: p.param.getIdentifier('intf') + (jsTxt ? '\t' + jsTxt : '')
						};
						if (!Array.isArray(docs.tags))
							docs.tags = [];
						docs.tags.push(jsDoc);
					}
				});
				let returnDoc = [] as string [];
				let throwsDoc = [] as string [];
				sig.responses.forEach((v, k) => {
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

	generate(alnType: 'intf', api: AINTF): Promise<MINTF>;
	generate(alnType: 'impl', api: AIMPL): Promise<MIMPL>;
	async generate(alnType: 'intf' | 'impl', api: AINTF | AIMPL): Promise<MINTF | MIMPL> {
		const id = this.getIdentifier(alnType);
		let meth = (api as AINTF | AIMPL).getMethod(id) as MINTF | MIMPL;
		if (!meth) {
			const sig = this.computeSignature();
			meth = await this.createTsMethod(alnType, api, id, sig);
			if (this.baseSettings.emitDescriptions) {
				if (alnType === 'intf' && isOpenApiLangNeutral<OpenAPIV3_1.OperationObject, Method>(this)) {
					const docs = this.makeJsDoc(sig);
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
	protected async createTsMethod(_alnType: 'intf' | 'impl', _owner: AINTF | AIMPL, _id: string, signature: TsMethodSignature): Promise<MINTF | MIMPL> {
		throw new Error('Not Implemented');
	}

	computeSignature(): TsMethodSignature {
		let preferredStatus: number;
		const params = this.parameters.filter(p => isTsmorphParameter(p)) as TsMorphParameter[];
		const responses = Array.from(this.responses.keys()).reduce((p, key) => {
			if (key.startsWith('2') || key.startsWith('d') || key.startsWith('D')) {
				if (!preferredStatus)
					if (/2[0-9][0-9]/.test(key))
						preferredStatus = Number(key);
				const r = this.responses.get(key);
				if (isTsmorphResponse(r) && isTsmorphModel(r.model))
					p.push(r);
			}
			return p;
		}, [] as TsmorphResponse[]);

		let elems = responses.map(r => (r.model as TsmorphModel).getTypeNode().getText());
		let rspTypeTxt = (Array.from(new Set(elems)).join(' | ') || 'void').trim();
		if (/\s/.test(rspTypeTxt))
			rspTypeTxt = `(${rspTypeTxt})`;
		return {
			params: params.map(p => {
				let typeTxt = p.model.getTypeNode().getText();
				if (/\s/.test(typeTxt))
					typeTxt = `(${typeTxt})`;
				return {
					param: p,
					name: this.toParameterName(p.name),
					required: !!p.required,
					typeText: typeTxt
				};
			}),
			responses: new Map<string, TsmorphResponse>(Array.from(this.responses.entries() as any)),
			okRsp: responses,
			returnText: rspTypeTxt,
			preferredStatus: preferredStatus
		};
	}
}

export function isTsmorphMethod(obj: any): obj is TsmorphMethod<any, any, any, any> {
	if (obj)
		if (obj instanceof BaseTsmorphMethod)
			return true;
	return false;
}

export interface MethodMethodSignature extends MethodSignature {
	readonly $ast?: TsmorphMethod<any, any, any, any>;
	readonly $next?: MethodMethodSignature | MethodMethodDeclaration;
}

export interface MethodMethodDeclaration extends MethodDeclaration {
	readonly $ast?: TsmorphMethod<any, any, any, any>;
}
