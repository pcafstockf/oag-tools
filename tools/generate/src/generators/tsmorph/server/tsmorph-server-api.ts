import {Inject, Injectable} from 'async-injection';
import {BaseSettingsToken, BaseSettingsType} from 'oag-shared/lang-neutral/base';
import {TsMorphSettingsToken, TsMorphSettingsType} from '../../../settings/tsmorph';
import {TsmorphApi} from '../tsmorph-api';
import {TsMorphServerSettingsToken, TsMorphServerSettingsType} from '../../../settings/tsmorph-server';

@Injectable()
export class TsmorphServerApi extends TsmorphApi {
	constructor(
		@Inject(BaseSettingsToken)
			baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken)
			tsMorphSettings: TsMorphSettingsType,
		@Inject(TsMorphServerSettingsToken)
		protected tsMorphServerSettings: TsMorphServerSettingsType
	) {
		super(baseSettings, tsMorphSettings);
	}
}
