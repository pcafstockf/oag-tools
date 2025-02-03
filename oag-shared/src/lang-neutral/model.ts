import {InjectionToken} from 'async-injection';
import {OpenAPIV3_1} from 'openapi-types';
import {isOpenApiLangNeutral, LangNeutral, LangNeutralType, OpenApiLangNeutral, OpenApiLangNeutralBackRef} from './lang-neutral';

export type LangNeutralModelTypes = Extract<LangNeutralType, 'intf' | 'impl' | 'json'>;

export interface Model extends Omit<LangNeutral, 'getLangNode'> {
	getLangNode(type: LangNeutralModelTypes): unknown;

	readonly name?: string;

	/**
	 * Returns true if this type is physically or logically the same as another.
	 */
	modelsMatch(model: Readonly<Model>): boolean;
}

export interface UnionModel extends Model {
	readonly unionOf: ReadonlyArray<Readonly<Model>>;
}

export const CodeGenUnionModelToken = new InjectionToken<UnionModel>('codegen-union-model');

export interface SchemaModel extends Model, OpenApiLangNeutral<OpenAPIV3_1.SchemaObject, SchemaModel> {
	readonly nullable: boolean;
}

export type OpenApiSchemaWithModelRef = OpenAPIV3_1.SchemaObject & OpenApiLangNeutralBackRef<SchemaModel>;

/**
 * The v3.1 spec adds 'any'.
 * We artificially change 'string' to 'enum' when appropriate.
 * While left ambiguous by the spec, most tools default absence of type to mean 'object'.
 */
export const PrimitiveModelTypes = ['integer', 'number', 'string', 'boolean', 'null', 'object', 'any', 'enum'] as const;
export type PrimitiveModelType = typeof PrimitiveModelTypes[number];

export interface PrimitiveModel extends SchemaModel {
	readonly jsdType: PrimitiveModelType;
}

export const CodeGenPrimitiveModelToken = new InjectionToken<PrimitiveModel>('codegen-primitive-model');

export interface ArrayModel extends SchemaModel {
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

export interface RecordModel extends SchemaModel, UnionModel {
	readonly extendsFrom: ReadonlyArray<Readonly<Model>>;

	readonly properties: Readonly<Record<string, Readonly<RecordPropertyType>>>;
	/**
	 * false means no additional properties.
	 */
	readonly additionalProperties: Readonly<Model> | false;
}

export const CodeGenRecordModelToken = new InjectionToken<RecordModel>('codegen-record-model');

export interface TypedModel extends Model {
	readonly typeName: string;
	readonly importPath: string | null;
}

export function isModel(obj: Readonly<Object>): obj is Model {
	return typeof (obj as Model)?.getLangNode === 'function' && typeof (obj as Model)?.modelsMatch === 'function';
}

export function isSchemaModel(obj: Readonly<Object>): obj is SchemaModel {
	return isModel(obj) && isOpenApiLangNeutral(obj) && typeof (obj as SchemaModel).nullable === 'boolean';
}

export function isPrimitiveModel(obj: Readonly<Model>): obj is PrimitiveModel {
	const t = (obj as PrimitiveModel)?.jsdType;
	return t && isModel(obj) && PrimitiveModelTypes.includes(t);
}

export function isArrayModel(obj: Readonly<Model>): obj is ArrayModel {
	return isModel(obj) && isModel((obj as ArrayModel)?.items);
}

export function isRecordModel(obj: Readonly<Model>): obj is RecordModel {
	const p = (obj as RecordModel)?.properties;
	return p && isModel(obj) && typeof p === 'object';
}

export function isUnionModel(obj: Readonly<Model>): obj is UnionModel {
	return isModel(obj) && Array.isArray((obj as UnionModel)?.unionOf);
}

export function isTypedModel(obj: Readonly<Model>): obj is TypedModel {
	const p = (obj as TypedModel)?.importPath;
	return (p === null || typeof p === 'string') && isModel(obj);
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
export type CommonModelFactory = (key: CommonModelTypes) => Model;
export const CodeGenCommonModelsToken = new InjectionToken<CommonModelFactory>('codegen-common-models');
