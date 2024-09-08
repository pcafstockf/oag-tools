import {InjectionToken} from 'async-injection';
import {OpenAPIV3_1} from 'openapi-types';
import {FileBasedLangNeutral, IdentifiedLangNeutral, LangNeutral} from './lang-neutral';

export type ModelKind = 'primitive' | 'array' | 'record' | 'union' | 'intersection' | 'discriminated';

export interface Model<LANG_REF = unknown> extends LangNeutral<OpenAPIV3_1.SchemaObject, LANG_REF>, IdentifiedLangNeutral, FileBasedLangNeutral {
	readonly kind: ModelKind;

	/**
	 * Returns true if this type is physically or logically the same as another.
	 */
	matches(model: Model): boolean;
}

export type PrimitiveModelTypes = 'integer' | 'number' | 'string' | 'boolean' | 'null' | 'any';

export interface PrimitiveModel<LANG_REF = unknown> extends Model<LANG_REF> {
	readonly kind: 'primitive';

	readonly jsdType: PrimitiveModelTypes;

	/**
	 * This is of questionable use in code generation (mostly about validation).
	 * But it could be useful for a few such as dates, binary, etc.
	 * Returned keys are the property names (e.g. 'format', 'exclusiveMaximum', etc.).
	 */
	readonly jsdConstraints: Record<string, string | number | boolean>;
}

export const CodeGenPrimitiveModelToken = new InjectionToken<PrimitiveModel>('codegen-primitive-model');

export interface ArrayModel<LANG_REF = unknown> extends Model<LANG_REF> {
	readonly kind: 'array';

	/**
	 * Model may be synthetically constructed.
	 */
	readonly items: Readonly<Model>;

	setItems(items: Model): void;

	/**
	 * This is of questionable use in code generation (mostly about validation).
	 * But it could be useful for a few such as 'uniqueItems' (perhaps you want to use a Set).
	 * Returned keys are the property names (e.g. 'uniqueItems', 'minItems', 'additionalItems', etc.).
	 */
	readonly jsdConstraints: Record<string, string | number | boolean>;
}

export const CodeGenArrayModelToken = new InjectionToken<ArrayModel>('codegen-array-model');

export interface RecordPropertyType {
	model: Model,
	required?: boolean;
}

export interface RecordModel<LANG_REF = unknown> extends Model<LANG_REF> {
	readonly kind: 'record';

	/**
	 * Models may be synthetically constructed, but are always defined.
	 */
	readonly properties: Readonly<Record<string, Readonly<RecordPropertyType>>>;

	addProperty(name: string, prop: Model, required: boolean): void;

	/**
	 * Model may be synthetically constructed.
	 * false means no additional properties.
	 */
	readonly additionalProperties: Model | false;

	/**
	 * This is of questionable use in code generation (all about validation).
	 */
	readonly jsdConstraints: Record<string, string | number | boolean>;
}

export const CodeGenRecordModelToken = new InjectionToken<RecordModel>('codegen-record-model');


export interface CommonModels<LANG_REF extends any = unknown> {
	['void']: Model<LANG_REF>,  // nothing here, absence of property
	['undefined']: Model<LANG_REF>, // uninitialized property
	['null']: Model<LANG_REF>,  // property with no value
	['any']: Model<LANG_REF>,   // property contains literally anything (except 'void').
	['integer']: Model<LANG_REF>,
	['number']: Model<LANG_REF>,
	['string']: Model<LANG_REF>,
	['boolean']: Model<LANG_REF>,
	['array']: Model<LANG_REF>,
	['object']: Model<LANG_REF>,
	['binary']: Model<LANG_REF>,
	['byte']: Model<LANG_REF>,
	['date']: Model<LANG_REF>,
	['date-time']?: Model<LANG_REF>,
	['regex']?: Model<LANG_REF>,
	['uri']?: Model<LANG_REF>,
	['float']: Model<LANG_REF>,
	['double']: Model<LANG_REF>,
	['int32']: Model<LANG_REF>,
	['int64']: Model<LANG_REF>,
	['time']?: Model<LANG_REF>,
	['duration']?: Model<LANG_REF>,

	[key: string]: Model<LANG_REF>,
}

export const CodeGenCommonModelsToken = new InjectionToken<CommonModels>('codegen-common-models');
