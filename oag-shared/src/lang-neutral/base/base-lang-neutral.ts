import {interpolateBashStyle} from '../../utils/misc-utils';
import * as nameUtils from '../../utils/name-utils';
import {CodeGenAst, LangNeutral, LangNeutralTypes, MixinConstructor, OpenApiLangNeutral, OpenApiLangNeutralBackRef} from '../lang-neutral';
import {BaseSettingsType} from './base-settings';

export type BaseLangNeutralConstructor<T extends BaseLangNeutral = BaseLangNeutral> = new (baseSettings: BaseSettingsType) => T;

export abstract class BaseLangNeutral<LANG_REF = unknown> implements LangNeutral<LANG_REF> {
	constructor(protected baseSettings: BaseSettingsType) {
	}

	abstract getType(type: LangNeutralTypes): LANG_REF;

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

export function MixOpenApiLangNeutral<OAE, AST, T extends MixinConstructor = MixinConstructor>(base: T) {
	return class BaseOpenApiLangNeutral extends base implements OpenApiLangNeutral<OAE, AST> {
		get oae(): OAE & OpenApiLangNeutralBackRef<AST> {
			return this.#oae;
		}

		#oae: OAE & OpenApiLangNeutralBackRef<AST>;

		setOae(oae: OAE) {
			if (oae) {
				this.#oae = Object.assign(oae, {
					[CodeGenAst]: this
				}) as OAE & OpenApiLangNeutralBackRef<AST>;
			}
			else
				this.#oae = undefined;
		}
	};
}
