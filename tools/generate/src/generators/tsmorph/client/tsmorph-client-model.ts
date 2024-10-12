import {Inject, Injectable} from 'async-injection';
import {BaseSettingsToken, BaseSettingsType} from 'oag-shared/lang-neutral/base';
import {TsMorphSettingsToken, TsMorphSettingsType} from '../../../settings/tsmorph';
import {TsmorphArrayModel, TsmorphUnionModel, TsmorphPrimitiveModel, TsmorphRecordModel} from '../tsmorph-model';
import {TsMorphClientSettingsToken, TsMorphClientSettingsType} from '../../../settings/tsmorph-client';

@Injectable()
export class TsmorphPrimitiveClientModel extends TsmorphPrimitiveModel {
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
export class TsmorphArrayClientModel extends TsmorphArrayModel {
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
export class TsmorphRecordClientModel extends TsmorphRecordModel {
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
export class TsmorphUnionClientModel extends TsmorphUnionModel {
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
