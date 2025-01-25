import {LangNeutralApiTypes} from 'oag-shared/lang-neutral/api';
import {BaseOpenApiResponse, BaseSettingsType} from 'oag-shared/lang-neutral/base';
import {OpenApiResponse} from 'oag-shared/lang-neutral/response';
import {ReturnTypedNode} from 'ts-morph';
import {TsMorphSettingsType} from '../../settings/tsmorph';
import {bindAst} from './oag-tsmorph';
import {TsmorphMethod} from './tsmorph-method';
import {TsmorphModel} from './tsmorph-model';

export interface TsmorphResponse extends OpenApiResponse {
	getLangNode(type: 'intf'): ResponseReturnTypedNode;

	getLangNode(type: 'impl'): ResponseReturnTypedNode;

	getLangNode(type: 'hndl'): ResponseReturnTypedNode;

	getLangNode(type: 'mock'): ResponseReturnTypedNode;

	generate(method: TsmorphMethod, code: string): Promise<void>;
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
	getLangNode(type: 'impl'): ResponseReturnTypedNode;
	getLangNode(type: 'hndl'): ResponseReturnTypedNode;
	getLangNode(type: 'mock'): ResponseReturnTypedNode;
	override getLangNode(type: LangNeutralApiTypes): ResponseReturnTypedNode {
		return this.#tsTypes[type];
	}

	bind(alnType: 'intf', ast: Omit<ResponseReturnTypedNode, '$ast'>): ResponseReturnTypedNode;
	bind(alnType: 'impl', ast: Omit<ResponseReturnTypedNode, '$ast'>): ResponseReturnTypedNode;
	bind(alnType: 'hndl', ast: Omit<ResponseReturnTypedNode, '$ast'>): ResponseReturnTypedNode;
	bind(alnType: 'mock', ast: Omit<ResponseReturnTypedNode, '$ast'>): ResponseReturnTypedNode;
	bind(alnType: LangNeutralApiTypes, ast: Omit<ResponseReturnTypedNode, '$ast'>): ResponseReturnTypedNode {
		this.#tsTypes[alnType] = bindAst(ast as any, this) as any;
		return this.#tsTypes[alnType];
	}

	async generate(method: TsmorphMethod, code: string): Promise<void> {
		const sf = method.getLangNode('intf').getSourceFile();
		await (this.model as TsmorphModel).generate(sf);
		let intf = method.getLangNode('intf');
		if (intf && (!this.getLangNode('intf'))) {
			const txt = (this.model as TsmorphModel).getTypeNode().getText();
			intf.setReturnType(txt);
			(this.model as TsmorphModel).importInto(sf);
		}
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
