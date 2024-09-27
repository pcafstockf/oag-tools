import {BaseSettingsType, BaseApi} from 'oag-shared/lang-neutral/base';
import {ClassDeclaration, InterfaceDeclaration} from 'ts-morph';
import {TsMorphSettingsType} from '../../settings/tsmorph';

export class TsmorphApi extends BaseApi<InterfaceDeclaration | ClassDeclaration> {
	protected constructor(baseSettings: BaseSettingsType, protected readonly tsMorphSettings: TsMorphSettingsType) {
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

interface ApiInterfaceDeclaration extends InterfaceDeclaration {
	readonly $ast: TsmorphApi;
}

interface ApiClassDeclaration extends ClassDeclaration {
	readonly $ast: TsmorphApi;
}
