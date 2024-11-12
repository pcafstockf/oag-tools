import {BaseApi, BaseSettingsType} from 'oag-shared/lang-neutral/base';
import {ClassDeclaration, InterfaceDeclaration} from 'ts-morph';
import {TsMorphSettingsType} from '../../settings/tsmorph';

export class TsmorphApi extends BaseApi {
	protected constructor(baseSettings: BaseSettingsType, protected readonly tsMorphSettings: TsMorphSettingsType) {
		super(baseSettings);
	}

	getLangNode(type: 'intf'): ApiInterfaceDeclaration;
	getLangNode(type: 'impl'): ApiClassDeclaration;
	getLangNode(type: 'hndl'): ApiClassDeclaration;
	getLangNode(type: string): ApiInterfaceDeclaration | ApiClassDeclaration {
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
