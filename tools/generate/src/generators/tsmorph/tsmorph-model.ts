import {Inject, Injectable} from 'async-injection';
import {LangNeutralTypes, Model} from 'oag-shared/lang-neutral';
import {BaseArrayModel, BaseMixedModel, BasePrimitiveModel, BaseRecordModel, BaseSettingsToken, BaseSettingsType, BaseSyntheticModel} from 'oag-shared/lang-neutral/base';
import {BaseModel, BaseModelConstructor, BaseTypedModel} from 'oag-shared/lang-neutral/base/base-model';
import {CombinedModelKind, ModelKind} from 'oag-shared/lang-neutral/model';
import {ClassDeclaration, InterfaceDeclaration, ObjectLiteralElement} from 'ts-morph';
import {TsMorphSettingsToken, TsMorphSettingsType} from '../../settings/tsmorph';

interface ModelInterfaceDeclaration extends InterfaceDeclaration {
	readonly $ast: Model<InterfaceDeclaration | ClassDeclaration | ObjectLiteralElement>;
}
interface ModelClassDeclaration extends ClassDeclaration {
	readonly $ast: Model<InterfaceDeclaration | ClassDeclaration | ObjectLiteralElement>;
}
interface ModelObjectLiteralElement extends ObjectLiteralElement {
	readonly $ast: Model<InterfaceDeclaration | ClassDeclaration | ObjectLiteralElement>;
}
type TsmorphModelTypes = ModelInterfaceDeclaration | ModelClassDeclaration | ModelObjectLiteralElement;

function MixTsmorphModel<T>(base: T) {
	const derived = class TsmorphModel extends (base as BaseModelConstructor) implements Model<TsmorphModelTypes> {
		constructor(baseSettings: BaseSettingsType, protected readonly tsMorphSettings: TsMorphSettingsType, kind?: ModelKind) {
			super(baseSettings, kind);
		}

		getType(type: 'intf'): ModelInterfaceDeclaration;
		getType(type: 'impl'): ModelClassDeclaration;
		getType(type: 'json'): ModelObjectLiteralElement;
		override getType(type: LangNeutralTypes): TsmorphModelTypes {
			return this.#tsTypes[type];
		}
		#tsTypes: Record<string, TsmorphModelTypes>;
	};
	return derived as unknown as new (baseSettings: BaseSettingsType, tsMorphSettings: TsMorphSettingsType, kind?: ModelKind) => T & typeof derived.prototype;
}

@Injectable()
export class TsmorphPrimitiveModel extends MixTsmorphModel<BasePrimitiveModel<TsmorphModelTypes>>(BasePrimitiveModel as any) {
	constructor(
		@Inject(BaseSettingsToken)
		baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken)
		tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, tsMorphSettings);
	}
}

@Injectable()
export class TsmorphArrayModel extends MixTsmorphModel<BaseArrayModel<TsmorphModelTypes>>(BaseArrayModel as any) {
	constructor(
		@Inject(BaseSettingsToken)
		baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken)
		tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, tsMorphSettings);
	}
}

@Injectable()
export class TsmorphRecordModel extends MixTsmorphModel<BaseRecordModel<TsmorphModelTypes>>(BaseRecordModel as any) {
	constructor(
		@Inject(BaseSettingsToken)
		baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken)
		tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, tsMorphSettings);
	}
}

export class TsmorphMixedModel extends MixTsmorphModel<BaseMixedModel<TsmorphModelTypes>>(BaseMixedModel as any) {
	constructor(
		baseSettings: BaseSettingsType,
		kind: CombinedModelKind,
		tsMorphSettings: TsMorphSettingsType
	) {
		super(baseSettings, tsMorphSettings, kind);
	}
}

export class TsmorphSyntheticModel extends MixTsmorphModel<BaseSyntheticModel<TsmorphModelTypes>>(BaseSyntheticModel as any) {
	constructor(
		baseSettings: BaseSettingsType,
		kind: CombinedModelKind,
		tsMorphSettings: TsMorphSettingsType
	) {
		super(baseSettings, tsMorphSettings, kind);
	}
}

@Injectable()
export class TsmorphTypedModel extends MixTsmorphModel<BaseTypedModel<TsmorphModelTypes>>(BaseTypedModel as any) {
	constructor(
		@Inject(BaseSettingsToken)
		baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken)
		tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, tsMorphSettings, 'typed');
	}
}
