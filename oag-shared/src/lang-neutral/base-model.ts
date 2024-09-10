import os from 'node:os';
import path from 'node:path';
import {OpenAPIV3_1} from 'openapi-types';
import {isEqualWith as lodashIsEqualWith} from 'lodash';
import {BaseFileBasedLangNeutral} from './base-lang-neutral';
import {BaseSettingsType} from './base-settings';
import {LangNeutralTypes} from './lang-neutral';
import {ArrayModel, CommonModels, Model, ModelKind, PrimitiveModel, PrimitiveModelTypes, RecordModel, RecordPropertyType} from './model';

export abstract class BaseModel<LANG_REF extends any = unknown> extends BaseFileBasedLangNeutral<OpenAPIV3_1.SchemaObject, LANG_REF> implements Model<LANG_REF> {
	protected constructor(baseSettings: BaseSettingsType) {
		super(baseSettings);
	}

	init(doc: OpenAPIV3_1.Document, jsonPath: string, oae: OpenAPIV3_1.SchemaObject): Model {
		super.init(doc, jsonPath, oae);
		const basePath = '#/components/schemas/';
		if (jsonPath && jsonPath.startsWith(basePath) && jsonPath.indexOf('/', basePath.length) < 0)
			this.#schemaName = jsonPath.slice(basePath.length);
		return this;
	}

	#schemaName: string;

	abstract getType(type: string): LANG_REF;

	abstract readonly kind: ModelKind;

	/**
	 * Returns true if this Model is physically or logically the same as another.
	 */
	matches(model: Model): boolean {
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
				return lodashIsEqualWith(a, b, (va, vb, key) => {
					// OpenApi does not have '$' prefixed properties, so we just pretend those are equal.
					if (typeof key === 'string' && key.startsWith('$'))
						return true;
					return undefined;   // Let lodash decide.
				});
		return false;
	}

	getIdentifier(type: 'intf' | 'impl' | 'json'): string {
		const name = this.ensureModelName();
		if (!name)
			return;
		switch (type) {
			case 'intf':
				return this.toIntfName(name, 'model');
			case 'impl':
				return this.toImplName(name, 'model');
			case 'json':
				return this.toJsonName(name);
		}
	}

	protected ensureModelName(): string {
		const oae = this.oae;
		let name = oae.title;
		if (!name)
			name = (oae as any)['x-schema-name'];
		if (!name)
			name = this.#schemaName;
		return name;
	}

	getFilepath(type: 'intf' | 'impl' | 'json'): string {
		const name = this.ensureModelName();
		if (!name)
			return;
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

export class BasePrimitiveModel<LANG_REF = unknown> extends BaseModel<LANG_REF> implements PrimitiveModel<LANG_REF> {
	readonly kind = 'primitive';

	constructor(
		baseSettings: BaseSettingsType,
		protected commonModels: CommonModels<LANG_REF>
	) {
		super(baseSettings);
	}

	getType(type: string): LANG_REF {
		let key = this.jsdType as string;
		const constraints = this.jsdConstraints;
		switch (key) {
			case 'string':
				switch (constraints['format']) {
					case 'binary':
					case 'byte':
					case 'date':
					case 'date-time':
					case 'uri':
					case 'regex':
						key = constraints['format'];
						break;
				}
				break;
			case 'number':
				switch (constraints['format']) {
					case 'float':
					case 'double':
						key = constraints['format'];
						break;
				}
				break;
			case 'integer':
				switch (constraints['format']) {
					case 'int32':
					case 'int64':
						key = constraints['format'];
						break;
				}
				break;
		}
		return this.commonModels[key]?.getType(type as LangNeutralTypes);
	}

	get jsdType(): PrimitiveModelTypes {
		const oae = this.oae;
		// We are by definition a primitive, so this cast is safe.
		return (oae.type as PrimitiveModelTypes) ?? 'any';
	}

	get jsdConstraints(): Record<string, string | number | boolean> {
		const oae = this.oae as any;
		return [
			/* These are just some of the format values possible:
				string:
					date,date-time,binary,byte,email,hostname,ipv4,ipv6,uri,uuid,regex,json-pointer,uri-reference,
				number:
					float,double,
				integer:
					int32,int64,
				custom:
					time,duration,
			 */
			'format',
			// numbers
			'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
			// strings
			'minLength', 'maxLength', 'pattern',
		].reduce((p, key) => {
			if (typeof oae[key] !== 'undefined')
				p[key] = oae[key];
			return p;
		}, {} as Record<string, string | number | boolean>);
	}

	toString(owned?: boolean) {
		let retVal = this.jsdType.toString();
		const id = this.getIdentifier('intf');
		if (owned)
			return id ?? retVal;
		const sf = this.getFilepath('intf');
		if (sf)
			retVal = `type ${id} = ${retVal}${os.EOL}`;
		return retVal;
	}
}

export class BaseArrayModel<LANG_REF = unknown> extends BaseModel<LANG_REF> implements ArrayModel<LANG_REF> {
	readonly kind = 'array';

	constructor(
		baseSettings: BaseSettingsType,
		protected commonModels: CommonModels<LANG_REF>
	) {
		super(baseSettings);
	}

	getType(type: string): LANG_REF {
		return this.commonModels['array'].getType(type as LangNeutralTypes);
	}

	get items(): Model {
		return this.#items;
	}

	setItems(items: Model): void {
		this.#items = items;
	}

	#items: Model;

	get jsdConstraints(): Record<string, string | number | boolean> {
		const oae = this.oae as any;
		return [
			'maxItems',
			'minItems',
			'uniqueItems'
		].reduce((p, key) => {
			if (typeof oae[key] !== 'undefined')
				p[key] = oae[key];
			return p;
		}, {} as Record<string, string | number | boolean>);
	}

	toString(owned?: boolean) {
		let retVal = `${(this.items.toString as any)(true)}[]`;
		const id = this.getIdentifier('intf');
		if (owned)
			return id ?? retVal;
		const sf = this.getFilepath('intf');
		if (sf)
			retVal = `type ${id} = ${retVal}${os.EOL}`;
		return retVal;
	}
}

export class BaseRecordModel<LANG_REF = unknown> extends BaseModel<LANG_REF> implements RecordModel<LANG_REF> {
	readonly kind = 'record';

	constructor(
		baseSettings: BaseSettingsType,
		protected commonModels: CommonModels<LANG_REF>
	) {
		super(baseSettings);
	}

	getType(type: string): LANG_REF {
		return this.commonModels['object'].getType(type as LangNeutralTypes);
	}

	get properties(): Readonly<Record<string, Readonly<RecordPropertyType>>> {
		return this.#properties;
	}

	addProperty(name: string, model: Model, required: boolean): void {
		if (!this.#properties)
			this.#properties = {};
		this.#properties[name] = {
			model: model,
			required: required
		};
	}

	#properties: Record<string, RecordPropertyType>;

	get additionalProperties(): Model | false {
		return this.#additionalProperties ?? false;
	}

	setAdditionalProperties(additionalProperties: Model): void {
		this.#additionalProperties = additionalProperties;
	}

	#additionalProperties: Model;

	get jsdConstraints(): Record<string, string | number | boolean> {
		const oae = this.oae as any;
		return [
			'minProperties',
			'maxProperties',
			'patternProperties',
		].reduce((p, key) => {
			if (typeof oae[key] !== 'undefined')
				p[key] = oae[key];
			return p;
		}, {} as Record<string, string | number | boolean>);
	}

	toString(owned?: boolean) {
		let retVal = `{${os.EOL}`;
		const props = this.properties;
		if (props) {
			Object.keys(props).forEach(key => {
				const p = props[key].model;
				const txt = (p.toString as any)(true);
				retVal += `\t${key}: ${txt}${os.EOL}`;
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
