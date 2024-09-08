import {Inject, Injectable} from 'async-injection';
import {CodeGenCommonModelsToken} from 'oag-shared/lang-neutral/model';
import {BaseSettingsToken, BaseSettingsType} from '../../../settings/base';
import {TsMorphSettingsToken, TsMorphSettingsType} from '../../../settings/tsmorph';
import {TsMorphClientSettingsToken, TsMorphClientSettingsType} from '../../../settings/tsmorph-client';
import {TsmorphArrayModel, TsmorphCommonModels, TsmorphPrimitiveModel, TsmorphRecordModel} from '../tsmorph-model';

@Injectable()
export class TsmorphPrimitiveClientModel extends TsmorphPrimitiveModel {
	constructor(
		@Inject(BaseSettingsToken)
			baseSettings: BaseSettingsType,
		@Inject(CodeGenCommonModelsToken)
			commonModels: TsmorphCommonModels,
		@Inject(TsMorphSettingsToken)
			tsMorphSettings: TsMorphSettingsType,
		@Inject(TsMorphClientSettingsToken)
		protected tsMorphClientSettings: TsMorphClientSettingsType
	) {
		super(baseSettings, commonModels, tsMorphSettings);
	}
}

@Injectable()
export class TsmorphArrayClientModel extends TsmorphArrayModel {
	constructor(
		@Inject(BaseSettingsToken)
			baseSettings: BaseSettingsType,
		@Inject(CodeGenCommonModelsToken)
			commonModels: TsmorphCommonModels,
		@Inject(TsMorphSettingsToken)
			tsMorphSettings: TsMorphSettingsType,
		@Inject(TsMorphClientSettingsToken)
		protected tsMorphClientSettings: TsMorphClientSettingsType
	) {
		super(baseSettings, commonModels, tsMorphSettings);
	}
}

@Injectable()
export class TsmorphRecordClientModel extends TsmorphRecordModel {
	constructor(
		@Inject(BaseSettingsToken)
			baseSettings: BaseSettingsType,
		@Inject(CodeGenCommonModelsToken)
			commonModels: TsmorphCommonModels,
		@Inject(TsMorphSettingsToken)
			tsMorphSettings: TsMorphSettingsType,
		@Inject(TsMorphClientSettingsToken)
		protected tsMorphClientSettings: TsMorphClientSettingsType
	) {
		super(baseSettings, commonModels, tsMorphSettings);
	}
}
