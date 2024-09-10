import {OpenAPIV3_1} from 'openapi-types';
import {interpolateBashStyle} from '../utils/misc-utils';
import * as nameUtils from '../utils/name-utils';
import {BaseSettingsType} from './base-settings';
import {IdentifiedLangNeutral, LangNeutral} from './lang-neutral';

export abstract class BaseLangNeutral<OAE, LANG_REF = unknown> implements LangNeutral<OAE, LANG_REF> {
	protected constructor(protected baseSettings: BaseSettingsType) {
	}

	get oae(): OAE {
		return this.#oae;
	}

	#oae: OAE;

	init(doc: OpenAPIV3_1.Document, jsonPath: string, oae: OAE) {
		this.#oae = oae;
	}

	abstract getType(type: 'json' | 'hndl' | 'intf' | 'impl'): LANG_REF;

	protected toIntfName(name: string, type: 'api' | 'model'): string {
		let templ = this.baseSettings.intfName_Tmpl;
		if (type === 'api' && this.baseSettings.apiIntfName_Tmpl)
			templ = this.baseSettings.apiIntfName_Tmpl;
		else if (type === 'model' && this.baseSettings.modelIntfName_Tmpl)
			templ = this.baseSettings.modelIntfName_Tmpl;
		let iname = interpolateBashStyle(templ, {name: name, typeSuffix: this.typeSuffix(type), intfSuffix: this.baseSettings.intfSuffix});
		return nameUtils.setCase(iname, this.baseSettings.intfNameCasing);
	}

	protected toIntfFileBasename(name: string, type: 'api' | 'model'): string {
		let templ = this.baseSettings.intfFileBasename_Tmpl;
		if (type === 'api' && this.baseSettings.apiIntfFileBasename_Tmpl)
			templ = this.baseSettings.apiIntfFileBasename_Tmpl;
		else if (type === 'model' && this.baseSettings.modelIntfFileBasename_Tmpl)
			templ = this.baseSettings.modelIntfFileBasename_Tmpl;
		let fname = interpolateBashStyle(templ, {name: name, typeSuffix: this.typeSuffix(type), intfFileSuffix: this.baseSettings.intfFileSuffix});
		return nameUtils.setCase(fname, this.baseSettings.fileCasing);
	}

	protected toImplName(name: string, type: 'api' | 'model'): string {
		let templ = this.baseSettings.implName_Tmpl;
		if (type === 'api' && this.baseSettings.apiImplName_Tmpl)
			templ = this.baseSettings.apiImplName_Tmpl;
		else if (type === 'model' && this.baseSettings.modelImplName_Tmpl)
			templ = this.baseSettings.modelImplName_Tmpl;
		let iname = interpolateBashStyle(templ, {name: name, typeSuffix: this.typeSuffix(type), implSuffix: this.baseSettings.implSuffix});
		return nameUtils.setCase(iname, this.baseSettings.implNameCasing);
	}

	protected toImplFileBasename(name: string, type: 'api' | 'model'): string {
		let templ = this.baseSettings.implFileBasename_Tmpl;
		if (type === 'api' && this.baseSettings.apiImplFileBasename_Tmpl)
			templ = this.baseSettings.apiImplFileBasename_Tmpl;
		else if (type === 'model' && this.baseSettings.modelImplFileBasename_Tmpl)
			templ = this.baseSettings.modelImplFileBasename_Tmpl;
		let fname = interpolateBashStyle(templ, {name: name, typeSuffix: this.typeSuffix(type), implFileSuffix: this.baseSettings.implFileSuffix});
		return nameUtils.setCase(fname, this.baseSettings.fileCasing);
	}

	protected toJsonName(name: string): string {
		let templ = this.baseSettings.jsonName_Tmpl;
		if (this.baseSettings.modelJsonName_Tmpl)
			templ = this.baseSettings.modelJsonName_Tmpl;
		let iname = interpolateBashStyle(templ, {name: name, jsonSuffix: this.baseSettings.jsonSuffix});
		return nameUtils.setCase(iname, this.baseSettings.jsonNameCasing);
	}

	protected toJsonFileBasename(name: string): string {
		let templ = this.baseSettings.jsonFileBasename_Tmpl;
		if (this.baseSettings.modelJsonFileBasename_Tmpl)
			templ = this.baseSettings.modelJsonFileBasename_Tmpl;
		let fname = interpolateBashStyle(templ, {name: name, jsonFileSuffix: this.baseSettings.jsonFileSuffix});
		return nameUtils.setCase(fname, this.baseSettings.fileCasing);
	}

	protected toHndlName(name: string): string {
		let templ = this.baseSettings.hndlName_Tmpl;
		let iname = interpolateBashStyle(templ, {name: name, hndlSuffix: this.baseSettings.hndlSuffix});
		return nameUtils.setCase(iname, this.baseSettings.hndlNameCasing);
	}

	protected toHndlFileBasename(name: string): string {
		let templ = this.baseSettings.hndlFileBasename_Tmpl;
		let fname = interpolateBashStyle(templ, {name: name, hndlFileSuffix: this.baseSettings.hndlFileSuffix});
		return nameUtils.setCase(fname, this.baseSettings.fileCasing);
	}

	protected toOperationName(name: string): string {
		return nameUtils.setCase(name, 'camel');
	}

	protected toParameterName(name: string): string {
		return nameUtils.setCase(name, 'camel');
	}

	private typeSuffix(type: string) {
		switch (type) {
			case 'api':
				return this.baseSettings.apiSuffix;
			case 'model':
				return this.baseSettings.modelSuffix;
			case 'json':
				return this.baseSettings.jsonSuffix;
			case 'hndl':
				return this.baseSettings.hndlSuffix;
			default:
				return '';
		}
	}
}

export abstract class BaseIdentifiedLangNeutral<OAE, LANG_REF = unknown> extends BaseLangNeutral<OAE, LANG_REF> implements IdentifiedLangNeutral {
	protected constructor(baseSettings: BaseSettingsType) {
		super(baseSettings);
	}

	abstract getIdentifier(type: 'json' | 'hndl' | 'intf' | 'impl'): string ;
}

export abstract class BaseFileBasedLangNeutral<OAE, LANG_REF = unknown> extends BaseIdentifiedLangNeutral<OAE, LANG_REF> implements IdentifiedLangNeutral {
	protected constructor(baseSettings: BaseSettingsType) {
		super(baseSettings);
	}

	abstract getFilepath(type: 'json' | 'hndl' | 'intf' | 'impl'): string;
}
