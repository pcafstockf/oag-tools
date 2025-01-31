import {LangNeutralApiTypes} from 'oag-shared/lang-neutral/api';
import {BaseOpenApiResponse, BaseSettingsType} from 'oag-shared/lang-neutral/base';
import {OpenApiResponse} from 'oag-shared/lang-neutral/response';
import {ReturnTypedNode} from 'ts-morph';
import {TsMorphSettingsType} from '../../settings/tsmorph';

export interface TsmorphResponse extends OpenApiResponse {
	getLangNode(alnType: LangNeutralApiTypes): ResponseReturnTypedNode;
}

export abstract class BaseTsmorphResponse extends BaseOpenApiResponse implements TsmorphResponse {
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
	getLangNode(type: LangNeutralApiTypes): ResponseReturnTypedNode {
		return this.#tsTypes[type];
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
