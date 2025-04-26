import {interpolateBashStyle} from '../../utils/misc-utils';
import * as nameUtils from '../../utils/name-utils';
import {CodeGenAst, MixinConstructor, OpenApiLangNeutral, OpenApiLangNeutralBackRef} from '../lang-neutral';
import {BaseSettingsType} from '../settings';

export type BaseLangNeutralConstructor<T extends BaseLangNeutral = BaseLangNeutral> = new (baseSettings: BaseSettingsType) => T;

export abstract class BaseLangNeutral {
	// noinspection TypeScriptAbstractClassConstructorCanBeMadeProtected
	constructor(protected baseSettings: BaseSettingsType) {
	}

	protected toIntfName(name: string, artifact: 'api' | 'model'): string {
		let iname = interpolateBashStyle(
			artifact === 'api' ? this.baseSettings.apiIntfName_Tmpl : this.baseSettings.modelIntfName_Tmpl, {
				name: name
			});
		return nameUtils.setCase(iname, this.baseSettings.intfNameCasing);
	}

	protected toIntfFileBasename(name: string, artifact: 'api' | 'model'): string {
		let fname = interpolateBashStyle(
			artifact === 'api' ? this.baseSettings.apiIntfFileBasename_Tmpl : this.baseSettings.modelIntfFileBasename_Tmpl, {
				name: name,
			});
		return nameUtils.setCase(fname, this.baseSettings.fileCasing);
	}

	protected toImplName(name: string, artifact: 'api' | 'model'): string {
		let iname = interpolateBashStyle(
			artifact === 'api' ? this.baseSettings.apiImplName_Tmpl : this.baseSettings.modelImplName_Tmpl, {
				name: name,
			});
		return nameUtils.setCase(iname, this.baseSettings.implNameCasing);
	}

	protected toImplFileBasename(name: string, artifact: 'api' | 'model'): string {
		let fname = interpolateBashStyle(
			artifact === 'api' ? this.baseSettings.apiImplFileBasename_Tmpl : this.baseSettings.modelImplFileBasename_Tmpl, {
				name: name,
			});
		return nameUtils.setCase(fname, this.baseSettings.fileCasing);
	}

	protected toJsonName(name: string): string {
		let iname = interpolateBashStyle(
			this.baseSettings.modelJsonName_Tmpl, {
				name: name,
			});
		return nameUtils.setCase(iname, this.baseSettings.jsonNameCasing);
	}

	protected toJsonFileBasename(name: string): string {
		let fname = interpolateBashStyle(
			this.baseSettings.modelJsonFileBasename_Tmpl, {
				name: name,
			});
		return nameUtils.setCase(fname, this.baseSettings.fileCasing);
	}

	protected toHndlName(name: string): string {
		let iname = interpolateBashStyle(
			this.baseSettings.apiHndlName_Tmpl, {
				name: name,
			});
		return nameUtils.setCase(iname, this.baseSettings.hndlNameCasing);
	}

	protected toHndlFileBasename(name: string): string {
		let fname = interpolateBashStyle(
			this.baseSettings.apiHndlFileBasename_Tmpl, {
				name: name,
			});
		return nameUtils.setCase(fname, this.baseSettings.fileCasing);
	}

	protected toMockName(name: string): string {
		let iname = interpolateBashStyle(
			this.baseSettings.apiMockName_Tmpl, {
				name: name,
			});
		return nameUtils.setCase(iname, this.baseSettings.mockNameCasing);
	}

	protected toMockFileBasename(name: string): string {
		let fname = interpolateBashStyle(
			this.baseSettings.apiMockFileBasename_Tmpl, {
				name: name,
			});
		return nameUtils.setCase(fname, this.baseSettings.fileCasing);
	}

	protected toOperationName(name: string): string {
		return nameUtils.setCase(name, 'camel');
	}

	protected toParameterName(name: string): string {
		return nameUtils.setCase(name, 'camel');
	}
}

export function MixOpenApiLangNeutral<OAE, AST, T extends MixinConstructor = MixinConstructor>(base: T) {
	return class BaseOpenApiLangNeutral extends base implements OpenApiLangNeutral<OAE, AST> {
		constructor(...args: any[]) {
			super(...args);
		}

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
