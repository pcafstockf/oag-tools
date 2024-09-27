import {LangNeutralTypes} from 'oag-shared/lang-neutral';
import {BaseSettingsType, BaseOpenApiResponse} from 'oag-shared/lang-neutral/base';
import {ReturnTypedNode} from 'ts-morph';
import {TsMorphSettingsType} from '../../settings/tsmorph';

interface ResponseReturnTypedNode extends ReturnTypedNode {
	readonly $ast: TsmorphResponse;
}

export abstract class TsmorphResponse extends BaseOpenApiResponse {
	protected constructor(baseSettings: BaseSettingsType, protected readonly tsMorphSettings: TsMorphSettingsType) {
		super(baseSettings);
	}

	getType(type: 'intf'): ResponseReturnTypedNode;
	getType(type: 'impl'): ResponseReturnTypedNode;
	getType(type: 'hndl'): ResponseReturnTypedNode;
	override getType(type: LangNeutralTypes): ResponseReturnTypedNode {
		return this.#tsTypes[type];
	}
	#tsTypes: Record<string, ResponseReturnTypedNode>;
}
