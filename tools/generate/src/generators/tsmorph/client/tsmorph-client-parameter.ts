import {Inject, Injectable} from 'async-injection';
import {BaseSettingsToken, BaseSettingsType} from '../../../settings/base';
import {TsMorphSettingsToken, TsMorphSettingsType} from '../../../settings/tsmorph';
import {TsMorphClientSettingsToken, TsMorphClientSettingsType} from '../../../settings/tsmorph-client';
import {TsmorphBodyParameter, TsmorphNamedParameter} from '../tsmorph-parameter';

@Injectable()
export class TsmorphClinetNamedParameter extends TsmorphNamedParameter {
	constructor(
		@Inject(BaseSettingsToken)
			baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken)
			tsMorphSettings: TsMorphSettingsType,
		@Inject(TsMorphClientSettingsToken)
		protected tsMorphClientSettings: TsMorphClientSettingsType
	) {
		super(baseSettings, tsMorphSettings);
	}
}

@Injectable()
export class TsmorphClientBodyParameter extends TsmorphBodyParameter {
	constructor(
		@Inject(BaseSettingsToken)
			baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken)
			tsMorphSettings: TsMorphSettingsType,
		@Inject(TsMorphClientSettingsToken)
		protected tsMorphClientSettings: TsMorphClientSettingsType
	) {
		super(baseSettings, tsMorphSettings);
	}

}
