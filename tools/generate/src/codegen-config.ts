import {mergeConfig} from 'dyflex-config';
import {cloneDeep, merge, mergeWith} from 'lodash';
import {interpolateBashStyle} from '../shared';
import * as nameUtils from './name-utils';
import {BaseSettings} from 'oag-shared/lang-neutral/base-settings';
import {ClientCodeGenConfig} from './settings/client';
import {TsMorphCodeGenConfig} from './settings/tsmorph';

// An internal constant that should contain all the properties and configuration known to this project.
// This does not mean that it will (or even needs to) contain properties invented/defined by extension/plugins.
const DefaultCodeGenConfig = merge(merge(merge(merge(cloneDeep(BaseSettings), TsMorphCodeGenConfig), ClientCodeGenConfig)));

type BaseCodeGenConfigType = Partial<typeof BaseSettings> & Partial<typeof ClientCodeGenConfig>;

function CodeGenConfig() {
	return {
		loadConfigObject(config: object) {
			if (config && typeof config === 'object') {
				config = JSON.parse(JSON.stringify(config));     // Lame attempt at avoiding exploits.
				mergeWith(this, config, (objValue, srcValue, key, object) => {
					if (key?.startsWith('!')) {
						object[key.substring(1)] = srcValue;
						return null;
					}
				}); // Perform a deep merge of this latest config into the current config.
			}
		},

		loadConfigArgs(args?: string[]) {
			// Now add any command line defined configuration properties.
			args?.forEach((v) => {
				let kvp = v.trim().split('=');
				let value: any;
				try {
					value = JSON.parse(kvp[1]);
				}
				catch {
					value = kvp[1];
				}
				lodash.set(this, kvp[0], value); // We validated the key already
			});
		},

		toIntfName(name: string, type: 'api' | 'model'): string {
			let templ = this.intfName_Tmpl;
			if (type === 'api' && this.apiIntfName_Tmpl)
				templ = this.apiIntfName_Tmpl;
			else if (type === 'model' && this.modelIntfName_Tmpl)
				templ = this.modelIntfName_Tmpl;
			let iname = interpolateBashStyle(templ, {name: name, typeSuffix: this.typeSuffix(type), intfSuffix: this.intfSuffix});
			return nameUtils.setCase(iname, this.intfNameCasing);
		},

		toIntfFileBasename(name: string, type: 'api' | 'model'): string {
			let templ = this.intfFileBasename_Tmpl;
			if (type === 'api' && this.apiIntfFileBasename_Tmpl)
				templ = this.apiIntfFileBasename_Tmpl;
			else if (type === 'model' && this.modelIntfFileBasename_Tmpl)
				templ = this.modelIntfFileBasename_Tmpl;
			let fname = interpolateBashStyle(templ, {name: name, typeSuffix: this.typeSuffix(type), intfFileSuffix: this.intfFileSuffix});
			return nameUtils.setCase(fname, this.fileCasing);
		},

		toImplName(name: string, type: 'api' | 'model'): string {
			let templ = this.implName_Tmpl;
			if (type === 'api' && this.apiImplName_Tmpl)
				templ = this.apiImplName_Tmpl;
			else if (type === 'model' && this.modelImplName_Tmpl)
				templ = this.modelImplName_Tmpl;
			let iname = interpolateBashStyle(templ, {name: name, typeSuffix: this.typeSuffix(type), implSuffix: this.implSuffix});
			return nameUtils.setCase(iname, this.implNameCasing);
		},

		toJsonName(name: string): string {
			let templ = this.jsonName_Tmpl;
			if (this.modelJsonName_Tmpl)
				templ = this.modelJsonName_Tmpl;
			let iname = interpolateBashStyle(templ, {name: name, jsonSuffix: this.jsonSuffix});
			return nameUtils.setCase(iname, this.jsonNameCasing);
		},

		toHndlName(name: string): string {
			let templ = this.hndlName_Tmpl;
			let iname = interpolateBashStyle(templ, {name: name, hndlSuffix: this.hndlSuffix});
			return nameUtils.setCase(iname, this.hndlNameCasing);
		},

		toOperationName(name: string): string {
			return nameUtils.setCase(name, 'camel');
		},

		toPropertyName(name: string): string {
			return nameUtils.setCase(name, 'camel');
		},

		toParameterName(name: string): string {
			return nameUtils.setCase(name, 'camel');
		},

		toImplFileBasename(name: string, type: 'api' | 'model'): string {
			let templ = this.implFileBasename_Tmpl;
			if (type === 'api' && this.apiImplFileBasename_Tmpl)
				templ = this.apiImplFileBasename_Tmpl;
			else if (type === 'model' && this.modelImplFileBasename_Tmpl)
				templ = this.modelImplFileBasename_Tmpl;
			let fname = interpolateBashStyle(templ, {name: name, typeSuffix: this.typeSuffix(type), implFileSuffix: this.implFileSuffix});
			return nameUtils.setCase(fname, this.fileCasing);
		},

		toJsonFileBasename(name: string): string {
			let templ = this.jsonFileBasename_Tmpl;
			if (this.modelJsonFileBasename_Tmpl)
				templ = this.modelJsonFileBasename_Tmpl;
			let fname = interpolateBashStyle(templ, {name: name, jsonFileSuffix: this.jsonFileSuffix});
			return nameUtils.setCase(fname, this.fileCasing);
		},

		toHndlFileBasename(name: string): string {
			let templ = this.hndlFileBasename_Tmpl;
			let fname = interpolateBashStyle(templ, {name: name, hndlFileSuffix: this.hndlFileSuffix});
			return nameUtils.setCase(fname, this.fileCasing);
		},

		typeSuffix(type: string) {
			switch (type) {
				case 'api':
					return this.apiSuffix;
				case 'model':
					return this.modelSuffix;
				case 'json':
					return this.jsonSuffix;
				default:
					return '';
			}
		}
	};
}

export type CodeGenConfig<T extends BaseCodeGenConfigType = BaseCodeGenConfigType> = T & ReturnType<typeof CodeGenConfig>;

export function makeCodeGenConfig<T extends BaseCodeGenConfigType = BaseCodeGenConfigType>(config?: T): CodeGenConfig {
	return Object.setPrototypeOf(CodeGenConfig(), mergeConfig(DefaultCodeGenConfig, config));
}
