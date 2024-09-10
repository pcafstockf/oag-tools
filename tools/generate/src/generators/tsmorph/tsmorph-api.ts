import {ClassDeclaration, InterfaceDeclaration} from 'ts-morph';
import {BaseSettingsType} from 'oag-shared/lang-neutral/base-settings';
import {TsMorphSettingsType} from '../../settings/tsmorph';
import {BaseApi} from 'oag-shared/lang-neutral/base-api';

export abstract class TsmorphApi extends BaseApi<InterfaceDeclaration | ClassDeclaration> {
	protected constructor(baseSettings: BaseSettingsType, protected tsMorphSettings: TsMorphSettingsType) {
		super(baseSettings);
	}

	getType(type: 'intf'): ApiInterfaceDeclaration;
	getType(type: 'impl'): ApiClassDeclaration;
	getType(type: 'hndl'): ApiClassDeclaration;
	getType(type: string): ApiInterfaceDeclaration | ApiClassDeclaration {
		return this.#tsTypes[type];
	}

	#tsTypes: Record<string, ApiInterfaceDeclaration | ApiClassDeclaration>;
}

export interface ApiInterfaceDeclaration extends InterfaceDeclaration {
	readonly $ast: TsmorphApi;
}

export interface ApiClassDeclaration extends ClassDeclaration {
	readonly $ast: TsmorphApi;
}
