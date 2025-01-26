import {LangNeutralApiTypes} from 'oag-shared/lang-neutral/api';
import {BaseOpenApiResponse, BaseSettingsType} from 'oag-shared/lang-neutral/base';
import {OpenApiResponse} from 'oag-shared/lang-neutral/response';
import {ReturnTypedNode} from 'ts-morph';
import {TsMorphSettingsType} from '../../settings/tsmorph';
import {bindAst} from './oag-tsmorph';
import {MethodMethodDeclaration, MethodMethodSignature} from './tsmorph-method';
import {isTsmorphModel, TsmorphModel} from './tsmorph-model';

export interface TsmorphResponse extends OpenApiResponse {
	getLangNode(alnType: LangNeutralApiTypes): ResponseReturnTypedNode;

	generate(alnType: 'intf', meth: MethodMethodSignature, code: string): Promise<void>;

	generate(alnType: 'impl' | 'hndl' | 'mock', meth: MethodMethodDeclaration, code: string): Promise<void>;
}

export abstract class BaseTsmorphResponse extends BaseOpenApiResponse {
	protected constructor(baseSettings: BaseSettingsType, protected readonly tsMorphSettings: TsMorphSettingsType) {
		super(baseSettings);
		this.#tsTypes = {} as any;
	}

	readonly #tsTypes: {
		intf: ResponseReturnTypedNode,
		impl: ResponseReturnTypedNode,
		hndl: ResponseReturnTypedNode
		mock: ResponseReturnTypedNode
	};

	getLangNode(type: 'intf'): ResponseReturnTypedNode;
	getLangNode(type: 'impl' | 'hndl' | 'mock'): ResponseReturnTypedNode;
	getLangNode(type: LangNeutralApiTypes): ResponseReturnTypedNode;
	override getLangNode(type: LangNeutralApiTypes): ResponseReturnTypedNode {
		return this.#tsTypes[type];
	}

	bind(alnType: 'intf', ast: Omit<ResponseReturnTypedNode, '$ast'>): ResponseReturnTypedNode;
	bind(alnType: 'impl' | 'hndl' | 'mock', ast: Omit<ResponseReturnTypedNode, '$ast'>): ResponseReturnTypedNode;
	bind(alnType: LangNeutralApiTypes, ast: Omit<ResponseReturnTypedNode, '$ast'>): ResponseReturnTypedNode;
	bind(alnType: LangNeutralApiTypes, ast: Omit<ResponseReturnTypedNode, '$ast'>): ResponseReturnTypedNode {
		this.#tsTypes[alnType] = bindAst(ast as any, this) as any;
		return this.#tsTypes[alnType];
	}

	generate(alnType: 'intf', meth: MethodMethodSignature, code: string): Promise<void>;
	generate(alnType: 'impl' | 'hndl' | 'mock', meth: MethodMethodDeclaration, code: string): Promise<void>;
	async generate(alnType: LangNeutralApiTypes, meth: MethodMethodSignature | MethodMethodDeclaration, code: string): Promise<void> {
		if (!this.getLangNode(alnType)) {
			const model = meth.$ast.responses.get(code).model;
			if (isTsmorphModel(model))
				this.createTsResponse(alnType, meth, code, model);
		}
	}

	protected createTsResponse(alnType: LangNeutralApiTypes, owner: MethodMethodSignature | MethodMethodDeclaration, code: string, model: TsmorphModel) {
		const txt = model.getTypeNode().getText();
		owner.setReturnType(txt);
	}
}

export function isTsmorphResponse(obj: any): obj is TsmorphResponse {
	if (obj)
		if (obj instanceof BaseTsmorphResponse)
			return true;
	return false;
}

interface ResponseReturnTypedNode extends ReturnTypedNode {
	readonly $ast?: TsmorphResponse;
}
