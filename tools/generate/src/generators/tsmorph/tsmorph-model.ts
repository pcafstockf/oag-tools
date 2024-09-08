import {CommonModels, Model} from 'oag-shared/lang-neutral/model';
import {ClassDeclaration, InterfaceDeclaration, ObjectLiteralElement} from 'ts-morph';
import {BaseSettingsType} from '../../settings/base';
import {TsMorphSettingsType} from '../../settings/tsmorph';
import {BaseArrayModel, BasePrimitiveModel, BaseRecordModel} from '../base-model';

interface ModelInterfaceDeclaration extends InterfaceDeclaration {
	readonly $ast: Model<InterfaceDeclaration | ClassDeclaration | ObjectLiteralElement>;
}

interface ModelClassDeclaration extends ClassDeclaration {
	readonly $ast: Model<InterfaceDeclaration | ClassDeclaration | ObjectLiteralElement>;
}

interface ModelObjectLiteralElement extends ObjectLiteralElement {
	readonly $ast: Model<InterfaceDeclaration | ClassDeclaration | ObjectLiteralElement>;
}

export type TsmorphModelTypes = ModelInterfaceDeclaration | ModelClassDeclaration | ModelObjectLiteralElement;
export type TsmorphCommonModels = CommonModels<TsmorphModelTypes>;

type BaseModelConstructor = new (...args: any[]) => {};

function MixinTsmorphModel<TBase extends BaseModelConstructor>(Base: TBase) {
	return class TsmorphModel extends Base {
		protected tsMorphSettings: TsMorphSettingsType;

		getType(type: 'intf'): ModelInterfaceDeclaration;
		getType(type: 'impl'): ModelClassDeclaration;
		getType(type: 'json'): ModelObjectLiteralElement;
		getType(type: string): TsmorphModelTypes {
			return this.#tsTypes[type];
		}

		#tsTypes: Record<string, TsmorphModelTypes>;
	};
}

export class TsmorphPrimitiveModel extends MixinTsmorphModel(BasePrimitiveModel) {
	constructor(
		baseSettings: BaseSettingsType,
		commonModels: TsmorphCommonModels,
		tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, commonModels);
		this.tsMorphSettings = tsMorphSettings;
	}
}

export class TsmorphArrayModel extends MixinTsmorphModel(BaseArrayModel) {
	constructor(
		baseSettings: BaseSettingsType,
		commonModels: TsmorphCommonModels,
		tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, commonModels);
		this.tsMorphSettings = tsMorphSettings;
	}
}

export class TsmorphRecordModel extends MixinTsmorphModel(BaseRecordModel) {
	constructor(
		baseSettings: BaseSettingsType,
		commonModels: TsmorphCommonModels,
		tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, commonModels);
		this.tsMorphSettings = tsMorphSettings;
	}
}
