import os from 'node:os';
import path from 'node:path';
import {Api, Method} from 'oag-shared/lang-neutral';
import {OpenAPIV3_1} from 'openapi-types';
import {BaseSettingsType} from '../settings/base';
import {BaseFileBasedLangNeutral} from './base-lang-neutral';

export abstract class BaseApi<LANG_REF extends any = unknown> extends BaseFileBasedLangNeutral<OpenAPIV3_1.TagObject, LANG_REF> implements Api<LANG_REF> {
	protected constructor(baseSettings: BaseSettingsType) {
		super(baseSettings);
	}

	abstract getType(type: string): LANG_REF;

	getIdentifier(type: 'intf' | 'impl' | 'hndl'): string {
		switch (type) {
			case 'intf':
				return this.toIntfName(this.oae.name, 'api');
			case 'impl':
				return this.toImplName(this.oae.name, 'api');
			case 'hndl':
				return this.toHndlName(this.oae.name);
		}
	}

	getFilepath(type: 'intf' | 'impl' | 'hndl'): string {
		switch (type) {
			case 'intf':
				return path.join(this.baseSettings.apiIntfDir, this.toIntfFileBasename(this.oae.name, 'api'));
			case 'impl':
				return path.join(this.baseSettings.apiImplDir, this.toImplFileBasename(this.oae.name, 'api'));
			case 'hndl':
				return path.join(this.baseSettings.apiHndlDir, this.toHndlFileBasename(this.oae.name));
		}
	}

	addMethod(method: Method): void {
		if (!this.#methods)
			this.#methods = [];
		this.#methods.push(method);
	}

	#methods: Method[];

	get methods(): Method[] {
		return this.#methods?.slice(0) ?? [];
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
