import {InjectionToken} from 'async-injection';
import {OpenAPIV3_1} from 'openapi-types';
import {LangNeutral, LangNeutralTypes, OpenApiLangNeutral, OpenApiLangNeutralBackRef} from './lang-neutral';

export type LangNeutralModelTypes = Extract<LangNeutralTypes, 'intf' | 'impl' | 'json'>;
export type ModelKind = 'primitive' | 'array' | 'record' | 'union' | 'intersection' | 'discriminated' | 'typed';

export interface Model<LANG_REF = unknown, KIND extends ModelKind = ModelKind> extends LangNeutral<LANG_REF> {
	readonly kind: KIND;
	readonly name?: string;

	/**
	 * Returns true if this type is physically or logically the same as another.
	 */
	matches(model: Model): boolean;
}

export interface SchemaModel<LANG_REF = unknown, KIND extends ModelKind = ModelKind> extends Model<LANG_REF, KIND>, OpenApiLangNeutral<OpenAPIV3_1.SchemaObject, SchemaModel> {
}
export type OpenApiSchemaWithModelRef = OpenAPIV3_1.SchemaObject & OpenApiLangNeutralBackRef<SchemaModel>;
export function isSchemaModel(obj: Model): obj is SchemaModel {
	return typeof (obj as unknown as SchemaModel).oae !== 'undefined';
}

export type CombinedModelKind = Extract<ModelKind, 'union' | 'intersection' | 'discriminated'>;
export interface CombinedModel<LANG_REF = unknown> extends Model<LANG_REF, CombinedModelKind> {
	readonly models: ReadonlyArray<Model<LANG_REF>>;
}
export type CombinedModelFactory<LANG_REF = unknown> = (kind: CombinedModelKind) => CombinedModel<LANG_REF>;

export interface SyntheticModel<LANG_REF = unknown> extends CombinedModel<LANG_REF> {
}
export const CodeGenSyntheticModelToken = new InjectionToken<CombinedModelFactory>('codegen-synthetic-model');

export interface MixedModel<LANG_REF = unknown> extends CombinedModel<LANG_REF>, SchemaModel<LANG_REF, CombinedModelKind> {
}
export const CodeGenMixedModelToken = new InjectionToken<CombinedModelFactory>('codegen-mixed-model');

export type PrimitiveModelTypes = 'integer' | 'number' | 'string' | 'boolean' | 'null' | 'any';
export interface PrimitiveModel<LANG_REF = unknown> extends SchemaModel<LANG_REF, 'primitive'> {
	readonly jsdType: PrimitiveModelTypes;
}
export const CodeGenPrimitiveModelToken = new InjectionToken<PrimitiveModel>('codegen-primitive-model');

export interface ArrayModel<LANG_REF = unknown> extends SchemaModel<LANG_REF, 'array'> {
	/**
	 * Model may be synthetically constructed.
	 */
	readonly items: Readonly<Model>;
}
export const CodeGenArrayModelToken = new InjectionToken<ArrayModel>('codegen-array-model');

export interface RecordPropertyType {
	readonly model: Model,
	readonly required?: boolean;
}
export interface RecordModel<LANG_REF = unknown> extends SchemaModel<LANG_REF, 'record'> {
	/**
	 * Models may be synthetically constructed, but are always defined.
	 */
	readonly properties: Readonly<Record<string, Readonly<RecordPropertyType>>>;

	/**
	 * Model may be synthetically constructed.
	 * false means no additional properties.
	 */
	readonly additionalProperties: Readonly<Model> | false;
}
export const CodeGenRecordModelToken = new InjectionToken<RecordModel>('codegen-record-model');

export interface TypedModel<LANG_REF = unknown> extends Model<LANG_REF, 'typed'> {
}
export const CodeGenTypedModelToken = new InjectionToken<TypedModel>('codegen-typed-model');

export const CommonModelKeys = [
	// 'undefined' is not a "type"
	'null',  // Property is present but its type is explicitly "no value".
	'any',   // Property whose type is literally anything (except 'void').
	'ANY',   // Like 'any', but never has a type name / alias.
	'VOID',  // nothing here, absence of property
	'UNKNOWN',  // Type cannot be determined
	'integer',
	'number',
	'string',
	'boolean',
	'array',
	'object',
	'binary',
	'byte',
	'date',
	'date-time',
	'regex',
	'uri',
	'float',
	'double',
	'int32',
	'int64',
	'time',
	'duration'
] as const;
export type CommonModelTypes = typeof CommonModelKeys[number];
export type CommonModelFactory<LANG_REF = unknown> = (key: CommonModelTypes) => Model<LANG_REF>;
export const CodeGenCommonModelsToken = new InjectionToken<CommonModelFactory>('codegen-common-models');
