// noinspection TypeScriptAbstractClassConstructorCanBeMadeProtected

import {isEqualWith as lodashIsEqualWith} from 'lodash';
import os from 'node:os';
import path from 'node:path';
import {OpenAPIV3_1} from 'openapi-types';
import {SchemaJsdConstraints} from '../../utils/openapi-utils';
import {FileBasedLangNeutral, isFileBasedLangNeutral, isIdentifiedLangNeutral, isOpenApiLangNeutral} from '../lang-neutral';
import {ArrayModel, isSchemaModel, LangNeutralModelTypes, Model, PrimitiveModel, PrimitiveModelType, RecordModel, RecordPropertyType, SchemaModel, TypedModel, UnionModel} from '../model';
import {BaseSettingsType} from '../settings';
import {BaseLangNeutral, MixOpenApiLangNeutral} from './base-lang-neutral';

export abstract class BaseModel extends BaseLangNeutral implements Model, FileBasedLangNeutral {
	constructor(baseSettings: BaseSettingsType) {
		super(baseSettings);
	}

	abstract getLangNode(type: LangNeutralModelTypes): unknown;

	modelsMatch(model: Model): boolean {
		if (Object.is(this, model))
			return true;
		return this.name === model.name;
	}

	get name(): string | undefined {
		return this.#name;
	}

	#name: string;

	setName(name: string) {
		this.#name = name;
	}

	getIdentifier(type: LangNeutralModelTypes): string | undefined {
		const name = this.name;
		if (!name)
			return;
		// A special hack that signifies this instance *implements* IdentifiedLangNeutral
		if (type === null)
			return true as any;
		switch (type) {
			case 'intf':
				return this.toIntfName(name, 'model');
			case 'impl':
				return this.toImplName(name, 'model');
			case 'json':
				return this.toJsonName(name);
		}
	}

	getFilepath(type: LangNeutralModelTypes): string {
		const name = this.name;
		if (!name)
			return;
		// A special hack that signifies this instance *implements* FileBasedLangNeutral
		if (type === null)
			return true as any;
		let base: string;
		switch (type) {
			case 'intf':
				base = this.toIntfFileBasename(name, 'model');
				if (this.baseSettings.modelIntfDir && base)
					return path.join(this.baseSettings.modelIntfDir, base);
				break;
			case 'impl':
				base = this.toImplFileBasename(name, 'model');
				if (this.baseSettings.modelImplDir && base)
					return path.join(this.baseSettings.modelImplDir, base);
				break;
			case 'json':
				base = this.toJsonFileBasename(name);
				if (this.baseSettings.modelJsonDir && base)
					return path.join(this.baseSettings.modelJsonDir, base);
				break;
			default:
				break;
		}
	}
}

export type BaseModelConstructor<T extends BaseModel = BaseModel> = new (baseSettings: BaseSettingsType) => T;

export abstract class BaseSchemaModel extends MixOpenApiLangNeutral<OpenAPIV3_1.SchemaObject, SchemaModel, BaseModelConstructor>(BaseModel) implements SchemaModel {
	constructor(baseSettings: BaseSettingsType) {
		super(baseSettings);
	}

	init(_doc: OpenAPIV3_1.Document, jsonPath: string, oae: OpenAPIV3_1.SchemaObject): this {
		this.setOae(oae);
		let name: string = oae.title || (oae as any)['x-schema-name'];
		if (!name) {
			const basePath = '#/components/schemas/';
			if (jsonPath && jsonPath.startsWith(basePath) && jsonPath.indexOf('/', basePath.length) < 0)
				name = jsonPath.slice(basePath.length);
		}
		if (name)
			this.setName(name);
		return this;
	}

	get nullable(): boolean {
		// Remember, we only generate code off OpenApi >=v3.1
		const types = this.oae?.type;
		if (Array.isArray(types))
			return types.includes('null');
		return false;
	}


	// noinspection JSUnusedGlobalSymbols
	/**
	 * Returns true if this Model is physically or logically the same as another.
	 */
	override modelsMatch(model: Model): boolean {
		if (!super.modelsMatch(model))
			return false;
		if (!isSchemaModel(model))
			return false;
		const a = this.oae;
		const b = model.oae;
		if (Object.is(a, b))
			return true;
		if (Array.isArray(a.type) && Array.isArray(b.type)) {
			const aSet = new Set(a.type);
			const bSet = new Set(b.type);
			for (let item of aSet)
				if (!bSet.has(item))
					return false;
		}
		if (a.type === b.type)
			if (a.format === b.format)
				return lodashIsEqualWith(a, b, (_va, _vb, key) => {
					// OpenApi does not have '$' prefixed properties, so we just pretend those are equal.
					if (typeof key === 'string' && key.startsWith('$'))
						return true;
					return undefined;   // Let lodash decide.
				});
		return false;
	}
}

export abstract class BaseUnionModel extends BaseSchemaModel implements UnionModel {
	constructor(baseSettings: BaseSettingsType) {
		super(baseSettings);
		this.#unionOf = [];
	}

	get unionOf(): ReadonlyArray<Readonly<Model>> {
		return this.#unionOf.slice();
	}

	#unionOf: Model[];

	addUnion(union: Model) {
		if (!this.#unionOf)
			this.#unionOf = [union];
		else
			this.#unionOf.push(union);
	}

	toString(owned?: boolean) {
		let id: string;
		let retVal = this.unionOf.reduce((p, m, i) => {
			if (i > 0)
				p += ' | ';
			p += (m.toString as any)(true);
			return p;
		}, '');
		if (isIdentifiedLangNeutral(this)) {
			id = this.getIdentifier('intf');
			if (owned)
				return id ?? retVal;
		}
		if (isFileBasedLangNeutral(this)) {
			if (this.getFilepath('intf') || this.getFilepath('impl'))
				retVal = `type ${id} = ${retVal}${os.EOL}`;
		}
		return retVal;
	}
}

export abstract class BasePrimitiveModel extends BaseSchemaModel implements PrimitiveModel {
	constructor(
		baseSettings: BaseSettingsType,
	) {
		super(baseSettings);
	}

	get jsdType(): PrimitiveModelType {
		const t = this.oae.type;
		if (t === 'string' && Array.isArray(this.oae.enum))
			return 'enum';
		return t as PrimitiveModelType ?? 'object';
	}

	toString(owned?: boolean) {
		let id: string;
		let retVal = this.jsdType as string;
		if (Array.isArray(retVal))
			retVal = retVal.join(' | ');
		else if (retVal === 'enum')
			retVal = this.oae.enum.map(e => `'${e}'`).join(' | ');
		if (isIdentifiedLangNeutral(this)) {
			id = this.getIdentifier('intf');
			if (owned)
				return id ?? retVal;
		}
		if (isFileBasedLangNeutral(this)) {
			if (this.getFilepath('intf') || this.getFilepath('impl'))
				retVal = `type ${id} = ${retVal}${os.EOL}`;
		}
		return retVal;
	}
}

export abstract class BaseArrayModel extends BaseSchemaModel implements ArrayModel {
	constructor(
		baseSettings: BaseSettingsType
	) {
		super(baseSettings);
	}

	get items(): Readonly<Model> {
		return this.#items;
	}

	#items: Model;

	setItems(items: Model): void {
		this.#items = items;
	}

	toString(owned?: boolean) {
		let id: string;
		let retVal = `${(this.items.toString as any)(true)}[]`;
		if (isIdentifiedLangNeutral(this)) {
			id = this.getIdentifier('intf');
			if (owned)
				return id ?? retVal;
		}
		if (isFileBasedLangNeutral(this)) {
			if (this.getFilepath('intf') || this.getFilepath('impl'))
				retVal = `type ${id} = ${retVal}${os.EOL}`;
		}
		return retVal;
	}
}

export abstract class BaseRecordModel extends BaseSchemaModel implements RecordModel {
	constructor(
		baseSettings: BaseSettingsType,
	) {
		super(baseSettings);
		this.#unionOf = [];
		this.#extendsFrom = [];
		this.#properties = {};
	}

	get properties(): Readonly<Record<string, Readonly<RecordPropertyType>>> {
		return this.#properties;
	}

	#properties: Record<string, RecordPropertyType>;

	addProperty(name: string, model: Model, required: boolean): void {
		if (!this.#properties)
			this.#properties = {};
		this.#properties[name] = {
			model: model,
			required: required
		};
	}

	get additionalProperties(): Readonly<Model> | false {
		return this.#additionalProperties ?? false;
	}

	#additionalProperties: Model;

	setAdditionalProperties(additionalProperties: Model): void {
		this.#additionalProperties = additionalProperties;
	}

	get extendsFrom(): ReadonlyArray<Readonly<Model>> {
		return this.#extendsFrom;
	}

	#extendsFrom: Model[];

	addExtendsFrom(sup: Model) {
		if (!this.#extendsFrom)
			this.#extendsFrom = [sup];
		else
			this.#extendsFrom.push(sup);
	}

	get unionOf(): ReadonlyArray<Readonly<Model>> {
		return this.#unionOf.slice();
	}

	#unionOf: Model[];

	addUnion(union: Model) {
		if (!this.#unionOf)
			this.#unionOf = [union];
		else
			this.#unionOf.push(union);
	}

	toString(owned?: boolean) {
		let retVal = `{${os.EOL}`;
		if (Array.isArray(this.extendsFrom) && this.extendsFrom.length > 0) {
			retVal = this.extendsFrom.reduce((p, m, i) => {
				if (i > 0)
					p += ' & ';
				p += (m.toString as any)(true);
				return p;
			}, '') + ` & ${retVal}${os.EOL}`;
		}
		if (Array.isArray(this.unionOf) && this.unionOf.length > 0) {
			retVal = this.unionOf.reduce((p, m, i) => {
				if (i > 0)
					p += ' | ';
				p += (m.toString as any)(true);
				return p;
			}, '& (') + ') ' + retVal;
		}
		const props = this.properties;
		if (props) {
			Object.keys(props).forEach(key => {
				const r = !!props[key].required;
				const p = props[key].model;
				const txt = (p.toString as any)(true);
				retVal += `\t${key}${r ? '' : '?'}: ${txt}${os.EOL}`;
			});
		}
		const ap = this.additionalProperties;
		if (ap) {
			const txt = (ap.toString as any)(true);
			retVal += `\t[key: string]: ${txt}${os.EOL}`;
		}
		retVal += `}`;
		const id = this.getIdentifier('intf');
		if (owned)
			return id ?? retVal;
		if (this.getFilepath('intf') || this.getFilepath('impl'))
			retVal = `type ${id} = ${retVal}${os.EOL}`;
		return retVal;
	}
}

export abstract class BaseTypedModel extends BaseSchemaModel implements TypedModel {
	constructor(
		baseSettings: BaseSettingsType
	) {
		super(baseSettings);
		this.#importPath = null;
	}

	get typeName(): string {
		return this.#typeName;
	}

	#typeName: string;

	setTypeName(txt: string, importPath?: string): this {
		this.#typeName = txt;
		if (importPath)
			this.#importPath = importPath;
		else
			this.#importPath = null;
		return this;
	}

	#importPath: string;

	get importPath(): string {
		return this.#importPath;
	}

	/**
	 * This is a language neutral toString, so it will return SchemaObject.type if it can (rather than this.typeName);
	 */
	toString(owned?: boolean) {
		let baseType: string;
		// This is a language neutral
		if (isOpenApiLangNeutral(this)) {
			const constraints = SchemaJsdConstraints(this.oae);
			if (constraints.format)
				baseType = `${this.oae.type}:${constraints.format}`;
			else if (this.oae.type)
				baseType = this.oae.type.toString();
		}
		if (this.name) {
			if (owned)
				return this.name;
			return `type ${this.name} = ${this.typeName || baseType}${os.EOL}`;
		}
		return baseType || this.typeName;
	}
}
