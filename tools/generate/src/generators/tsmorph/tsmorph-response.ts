import {ReturnTypedNode} from 'ts-morph';
import {BaseSettingsType} from '../../settings/base';
import {TsMorphSettingsType} from '../../settings/tsmorph';
import {BaseResponse} from '../base-response';

interface ResponseReturnTypedNode extends ReturnTypedNode {
	readonly $ast: TsmorphResponse;
}

export abstract class TsmorphResponse extends BaseResponse {
	protected constructor(baseSettings: BaseSettingsType, protected tsMorphSettings: TsMorphSettingsType) {
		super(baseSettings);
	}

	getType(type: 'intf'): ResponseReturnTypedNode;
	getType(type: 'impl'): ResponseReturnTypedNode;
	getType(type: 'hndl'): ResponseReturnTypedNode;
	getType(type: string): ResponseReturnTypedNode {
		return this.#tsTypes[type];
	}

	#tsTypes: Record<string, ResponseReturnTypedNode>;
}
