import {Inject, Injectable} from 'async-injection';
import {BaseSettingsToken, BaseSettingsType} from 'oag-shared/lang-neutral/settings';
import {TsMorphSettingsToken, TsMorphSettingsType} from '../../../settings/tsmorph';
import {TsMorphServerSettingsToken, TsMorphServerSettingsType} from '../../../settings/tsmorph-server';
import {CodeGenAst} from '../../source-generator';
import {TsmorphGenerator} from '../tsmorph-generator';

@Injectable()
export class TsmorphServerGenerator extends TsmorphGenerator {
	constructor(
		@Inject(BaseSettingsToken) baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken) tsmorphSettings: TsMorphSettingsType,
		@Inject(TsMorphServerSettingsToken) protected readonly tsmorphServerSettings: TsMorphServerSettingsType
	) {
		super(baseSettings, tsmorphSettings);
	}

	protected async preGenerate(ast: CodeGenAst): Promise<void> {
	}

	protected async postGenerate(ast: CodeGenAst): Promise<void> {
	}
}
