import {InjectionToken} from 'async-injection';
import {OpenAPIV3_1} from 'openapi-types';
import {LangNeutral, LangNeutralTypes, OpenApiLangNeutral, OpenApiLangNeutralBackRef} from './lang-neutral';

export type LangNeutralModelTypes = Extract<LangNeutralTypes, 'intf' | 'impl' | 'json'>;
export type ModelKind = 'primitive' | 'array' | 'record' | 'union' | 'typed';

export interface Model<LANG_REF = unknown, KIND extends ModelKind = ModelKind> extends LangNeutral<LANG_REF> {
	readonly kind: KIND;
	readonly name?: string;

	/**
	 * Returns true if this type is physically or logically the same as another.
	 */
	matches(model: Readonly<Model>): boolean;
}

export interface UnionModel<LANG_REF = unknown> extends Model<LANG_REF, 'union'> {
	readonly unionOf?: ReadonlyArray<Readonly<Model>>;
}
export const CodeGenUnionModelToken = new InjectionToken<UnionModel>('codegen-union-model');

export interface SchemaModel<LANG_REF = unknown, KIND extends ModelKind = ModelKind> extends Model<LANG_REF, KIND>, OpenApiLangNeutral<OpenAPIV3_1.SchemaObject, SchemaModel> {
	readonly nullable: boolean;
}
export type OpenApiSchemaWithModelRef = OpenAPIV3_1.SchemaObject & OpenApiLangNeutralBackRef<SchemaModel>;

export type PrimitiveModelTypes = 'integer' | 'number' | 'string' | 'enum' | 'boolean' | 'null' | 'any';
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
	readonly model: Readonly<Model>,
	readonly required?: boolean;
}
export interface RecordModel<LANG_REF = unknown> extends SchemaModel<LANG_REF, 'record'>, Omit<UnionModel<LANG_REF>, 'kind'> {
	readonly extendsFrom?: ReadonlyArray<Readonly<Model>>;

	readonly properties: Readonly<Record<string, Readonly<RecordPropertyType>>>;
	/**
	 * false means no additional properties.
	 */
	readonly additionalProperties: Readonly<Model> | false;
}
export const CodeGenRecordModelToken = new InjectionToken<RecordModel>('codegen-record-model');

export function isSchemaModel(obj: Readonly<Model>): obj is SchemaModel {
	return typeof (obj as unknown as SchemaModel).oae !== 'undefined';
}
export function isPrimitiveModel(obj: Readonly<Model>): obj is PrimitiveModel {
	return obj.kind === 'primitive';
}
export function isUnionModel(obj: Readonly<Model>): obj is UnionModel {
	if (obj.kind === 'union')
		return true;
	if (obj.kind === 'record')
		return Array.isArray((obj as RecordModel).unionOf)
	return false;
}
export function isRecordModel(obj: Readonly<Model>): obj is RecordModel {
	return obj.kind === 'record';
}

export interface TypedModel<LANG_REF = unknown> extends Model<LANG_REF, 'typed'> {
}
export const CodeGenTypedModelToken = new InjectionToken<TypedModel>('codegen-typed-model');

export const CommonModelKeys = [
	// 'undefined' is not a "type"
	'null',  // Property is present but its type is explicitly "no value".
	'any',   // Property whose type is literally anything (except 'void').
	'ANY',   // Like 'any', but a global with no matching OpenApi element (e.g. only a type, not an alias, etc.).
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
