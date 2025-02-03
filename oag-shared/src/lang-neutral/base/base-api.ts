import os from 'node:os';
import path from 'node:path';
import {OpenAPIV3_1} from 'openapi-types';
import {Api, LangNeutralApiTypes} from '../api';
import {Method} from '../method';
import {BaseSettingsType} from '../settings';
import {BaseLangNeutral, BaseLangNeutralConstructor, MixOpenApiLangNeutral} from './base-lang-neutral';

export abstract class BaseApi extends MixOpenApiLangNeutral<OpenAPIV3_1.TagObject, Api, BaseLangNeutralConstructor>(BaseLangNeutral as BaseLangNeutralConstructor) implements Api {
	protected constructor(baseSettings: BaseSettingsType) {
		super(baseSettings);
	}

	init(_doc: OpenAPIV3_1.Document, _jsonPath: string, tag: OpenAPIV3_1.TagObject): this {
		this.setOae(tag);
		return this;
	}

	get name(): string | undefined {
		return this.oae.name;
	}

	getIdentifier(type: LangNeutralApiTypes): string {
		const name = this.name;
		if (!name)
			return;
		// A special hack that signifies this instance *implements* IdentifiedLangNeutral
		if (type === null)
			return true as any;
		switch (type) {
			case 'intf':
				return this.toIntfName(name, 'api');
			case 'impl':
				return this.toImplName(name, 'api');
			case 'hndl':
				return this.toHndlName(name);
			case 'mock':
				return this.toMockName(name);
		}
	}

	abstract getLangNode(type: LangNeutralApiTypes): unknown;

	getFilepath(type: LangNeutralApiTypes): string {
		const name = this.name;
		if (!name)
			return;
		// A special hack that signifies this instance *implements* FileBasedLangNeutral
		if (type === null)
			return true as any;
		let base: string;
		switch (type) {
			case 'intf':
				base = this.toIntfFileBasename(name, 'api');
				if (this.baseSettings.apiIntfDir && base)
					return path.join(this.baseSettings.apiIntfDir, base);
				break;
			case 'impl':
				base = this.toImplFileBasename(name, 'api');
				if (this.baseSettings.apiImplDir && base)
					return path.join(this.baseSettings.apiImplDir, base);
				break;
			case 'hndl':
				base = this.toHndlFileBasename(name);
				if (this.baseSettings.apiHndlDir && base)
					return path.join(this.baseSettings.apiHndlDir, base);
				break;
			case 'mock':
				base = this.toMockFileBasename(name);
				if (this.baseSettings.apiMockDir && base)
					return path.join(this.baseSettings.apiMockDir, base);
				break;
			default:
				break;
		}
		return undefined;
	}

	get methods(): Method[] {
		return this.#methods?.slice(0) ?? [];
	}

	#methods: Method[];

	addMethod(method: Method): void {
		if (!this.#methods)
			this.#methods = [];
		this.#methods.push(method);
	}

	toString() {
		let retVal = `api ${this.getIdentifier('intf')} {${os.EOL}`;
		this.methods.forEach(m => {
			retVal += `\t${m.toString()}${os.EOL}`;
		});
		retVal += `}${os.EOL}`;
		return retVal;
	}
}
