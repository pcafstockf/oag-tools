import {LangNeutralType} from 'oag-shared/lang-neutral';
import {BaseOpenApiResponse, BaseSettingsType} from 'oag-shared/lang-neutral/base';
import {ReturnTypedNode} from 'ts-morph';
import {TsMorphSettingsType} from '../../settings/tsmorph';

interface ResponseReturnTypedNode extends ReturnTypedNode {
	readonly $ast: TsmorphResponse;
}

export abstract class TsmorphResponse extends BaseOpenApiResponse {
	protected constructor(baseSettings: BaseSettingsType, protected readonly tsMorphSettings: TsMorphSettingsType) {
		super(baseSettings);
	}

	getLangNode(type: 'intf'): ResponseReturnTypedNode;
	getLangNode(type: 'impl'): ResponseReturnTypedNode;
	getLangNode(type: 'hndl'): ResponseReturnTypedNode;
	override getLangNode(type: LangNeutralType): ResponseReturnTypedNode {
		return this.#tsTypes[type];
	}

	#tsTypes: Record<string, ResponseReturnTypedNode>;
}
