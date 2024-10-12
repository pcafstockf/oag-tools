// noinspection TypeScriptAbstractClassConstructorCanBeMadeProtected

import {isEqualWith as lodashIsEqualWith} from 'lodash';
import os from 'node:os';
import path from 'node:path';
import {OpenAPIV3_1} from 'openapi-types';
import {FileBasedLangNeutral, isFileBasedLangNeutral, isIdentifiedLangNeutral, MixinConstructor} from '../lang-neutral';
import {ArrayModel, isSchemaModel, LangNeutralModelTypes, Model, ModelKind, PrimitiveModel, PrimitiveModelTypes, RecordModel, RecordPropertyType, SchemaModel, TypedModel} from '../model';
import {BaseLangNeutral, MixOpenApiLangNeutral} from './base-lang-neutral';
import {BaseSettingsType} from './base-settings';

export abstract class BaseModel<LANG_REF = unknown, KIND extends ModelKind = ModelKind> extends BaseLangNeutral<LANG_REF> implements Model<LANG_REF, KIND>, FileBasedLangNeutral {
	constructor(baseSettings: BaseSettingsType, readonly kind: KIND) {
		super(baseSettings);
	}

	matches(model: Model): boolean {
		if (Object.is(this, model))
			return true;
		if (this.kind !== model.kind)
			return false;
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
		switch (type) {
			case 'intf':
				return path.join(this.baseSettings.modelIntfDir, this.toIntfFileBasename(name, 'model'));
			case 'impl':
				return path.join(this.baseSettings.modelImplDir, this.toImplFileBasename(name, 'model'));
			case 'json':
				return path.join(this.baseSettings.modelJsonDir, this.toJsonFileBasename(name));
		}
	}
}

export type BaseModelConstructor<LANG_REF = unknown, KIND extends ModelKind = ModelKind> = new (baseSettings: BaseSettingsType, kind: KIND) => BaseModel<LANG_REF, KIND>;

// @ts-ignore
export abstract class BaseSchemaModel<LANG_REF = unknown, KIND extends ModelKind = ModelKind> extends MixOpenApiLangNeutral<OpenAPIV3_1.SchemaObject, SchemaModel, BaseModelConstructor<LANG_REF, KIND>>(BaseModel as BaseModelConstructor<LANG_REF, KIND>) implements SchemaModel<LANG_REF, KIND> {
	constructor(baseSettings: BaseSettingsType, kind: KIND) {
		super(baseSettings, kind);
	}

	init(_doc: OpenAPIV3_1.Document, jsonPath: string, oae: OpenAPIV3_1.SchemaObject): this {
		this.setOae(oae);
		let name: string = oae.title || (oae as any)['x-schema-name'];
		if (! name) {
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
	override matches(model: Model): boolean {
		if (!super.matches(model))
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

// @ts-ignore
export abstract class BaseUnionModel<LANG_REF = unknown> extends BaseSchemaModel<LANG_REF, 'union'> implements UnionModel<LANG_REF> {
	constructor(baseSettings: BaseSettingsType) {
		super(baseSettings, 'union');
	}

	get unionOf(): ReadonlyArray<Readonly<Model>> {
		return this.#unionOf;
	}
	#unionOf: Model<LANG_REF>[];
	addUnion(union: Model<LANG_REF>) {
		if (! this.#unionOf)
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
			const sf = this.getFilepath('intf');
			if (sf)
				retVal = `type ${id} = ${retVal}${os.EOL}`;
		}
		return retVal;
	}
}

export abstract class BasePrimitiveModel<LANG_REF = unknown> extends BaseSchemaModel<LANG_REF, 'primitive'> implements PrimitiveModel<LANG_REF> {
	constructor(
		baseSettings: BaseSettingsType,
	) {
		super(baseSettings, 'primitive');
	}

	get jsdType(): PrimitiveModelTypes {
		return this.oae.type as PrimitiveModelTypes ?? 'any';
	}

	toString(owned?: boolean) {
		let id: string;
		let retVal = ((this.oae.type as PrimitiveModelTypes) ?? 'any') as string;
		if (retVal === 'string' && Array.isArray(this.oae.enum))
			retVal = this.oae.enum.map(e => `'${e}'`).join(' | ');
		if (isIdentifiedLangNeutral(this)) {
			id = this.getIdentifier('intf');
			if (owned)
				return id ?? retVal;
		}
		if (isFileBasedLangNeutral(this)) {
			const sf = this.getFilepath('intf');
			if (sf)
				retVal = `type ${id} = ${retVal}${os.EOL}`;
		}
		return retVal;
	}
}

export abstract class BaseArrayModel<LANG_REF = unknown> extends BaseSchemaModel<LANG_REF, 'array'> implements ArrayModel<LANG_REF> {
	constructor(
		baseSettings: BaseSettingsType
	) {
		super(baseSettings, 'array');
	}

	get items(): Model {
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
			const sf = this.getFilepath('intf');
			if (sf)
				retVal = `type ${id} = ${retVal}${os.EOL}`;
		}
		return retVal;
	}
}

export abstract class BaseRecordModel<LANG_REF = unknown> extends BaseSchemaModel<LANG_REF, 'record'> implements RecordModel<LANG_REF> {
	constructor(
		baseSettings: BaseSettingsType,
	) {
		super(baseSettings, 'record');
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

	get additionalProperties(): Model | false {
		return this.#additionalProperties ?? false;
	}

	#additionalProperties: Model;

	setAdditionalProperties(additionalProperties: Model): void {
		this.#additionalProperties = additionalProperties;
	}

	get extendsFrom(): ReadonlyArray<Readonly<Model>> {
		return this.#extendsFrom;
	}
	#extendsFrom: Model<LANG_REF>[];
	addExtendsFrom(sup: Model<LANG_REF>) {
		if (! this.#extendsFrom)
			this.#extendsFrom = [sup];
		else
			this.#extendsFrom.push(sup);
	}

	get unionOf(): ReadonlyArray<Readonly<Model>> {
		return this.#unionOf;
	}
	#unionOf: Model<LANG_REF>[];
	addUnion(union: Model<LANG_REF>) {
		if (! this.#unionOf)
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
			}, '& (') + ') ' + retVal ;
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
		const sf = this.getFilepath('intf');
		if (sf)
			retVal = `type ${id} = ${retVal}${os.EOL}`;
		return retVal;
	}
}

export abstract class BaseTypedModel<LANG_REF = unknown> extends BaseSchemaModel<LANG_REF, 'typed'> implements TypedModel<LANG_REF> {
	constructor(
		baseSettings: BaseSettingsType
	) {
		super(baseSettings, 'typed');
	}

	setTypedName(txt: string): this {
		this.#typedName = txt;
		return this;
	}
	#typedName: string;

	toString(owned?: boolean) {
		if (this.name)
			return (super.toString as any)(owned);
		return this.#typedName;
	}
}
