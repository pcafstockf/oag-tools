import {Inject, Injectable} from 'async-injection';
import {BaseSettingsToken, BaseSettingsType} from 'oag-shared/lang-neutral/base';
import {TsMorphSettingsToken, TsMorphSettingsType} from '../../../settings/tsmorph';
import {TsMorphServerSettingsToken, TsMorphServerSettingsType} from '../../../settings/tsmorph-server';
import {TsmorphArrayModel, TsmorphPrimitiveModel, TsmorphRecordModel, TsmorphUnionModel} from '../tsmorph-model';

@Injectable()
export class TsmorphPrimitiveServerModel extends TsmorphPrimitiveModel {
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

@Injectable()
export class TsmorphArrayServerModel extends TsmorphArrayModel {
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

@Injectable()
export class TsmorphRecordServerModel extends TsmorphRecordModel {
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

@Injectable()
export class TsmorphUnionServerModel extends TsmorphUnionModel {
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
