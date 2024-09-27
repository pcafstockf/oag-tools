import os from 'node:os';
import path from 'node:path';
import {OpenAPIV3_1} from 'openapi-types';
import {Api, LangNeutralApiTypes} from '../api';
import {LangNeutralTypes} from '../lang-neutral';
import {Method} from '../method';
import {BaseLangNeutral, BaseLangNeutralConstructor, MixOpenApiLangNeutral} from './base-lang-neutral';
import {BaseSettingsType} from './base-settings';

export abstract class BaseApi<LANG_REF = unknown> extends MixOpenApiLangNeutral<OpenAPIV3_1.TagObject, Api, BaseLangNeutralConstructor>(BaseLangNeutral as BaseLangNeutralConstructor) implements Api<LANG_REF> {
	protected constructor(baseSettings: BaseSettingsType) {
		super(baseSettings);
	}

	init(_doc: OpenAPIV3_1.Document, _jsonPath: string, tag: OpenAPIV3_1.TagObject): this {
		this.setOae(tag);
		return this;
	}

	abstract getType(type: LangNeutralTypes): LANG_REF;

	getIdentifier(type: LangNeutralApiTypes): string {
		switch (type) {
			case 'intf':
				return this.toIntfName(this.oae.name, 'api');
			case 'impl':
				return this.toImplName(this.oae.name, 'api');
			case 'hndl':
				return this.toHndlName(this.oae.name);
		}
	}

	getFilepath(type: LangNeutralApiTypes): string {
		switch (type) {
			case 'intf':
				return path.join(this.baseSettings.apiIntfDir, this.toIntfFileBasename(this.oae.name, 'api'));
			case 'impl':
				return path.join(this.baseSettings.apiImplDir, this.toImplFileBasename(this.oae.name, 'api'));
			case 'hndl':
				return path.join(this.baseSettings.apiHndlDir, this.toHndlFileBasename(this.oae.name));
		}
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
