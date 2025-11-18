import SwaggerParser from '@apidevtools/swagger-parser';
import {Container} from 'async-injection';
import * as JSON5 from 'json5';
import {Api, Model, Parameter} from 'oag-shared/lang-neutral';
import {BaseApi, BaseArrayModel, BaseBodyParameter, BaseMethod, BaseNamedParameter, BaseOpenApiResponse, BaseRecordModel, BaseSchemaModel, BaseSettingsToken, BaseTypedModel, BaseUnionModel, CodeGenApiToken, CodeGenArrayModelToken, CodeGenAst, CodeGenBodyParameterToken, CodeGenCommonModelsToken, CodeGenMethodToken, CodeGenNamedParameterToken, CodeGenOpenApiResponseToken, CodeGenRecordModelToken, CodeGenUnionModelToken, CommonModelTypes, OpenApiSchemaWithModelRef} from 'oag-shared/lang-neutral/base';
import {CodeGenTypedModelToken, isPrimitiveModel} from 'oag-shared/lang-neutral/model';
import {OpenAPIV3_1Visitor} from 'oag-shared/openapi/document-visitor';
import * as nameUtils from 'oag-shared/utils/name-utils';
import {SchemaJsdConstraints} from 'oag-shared/utils/openapi-utils';
import {OpenAPIV3_1} from 'openapi-types';
import {ClientSettingsToken, ClientSettingsType} from './settings/client';

interface SchemaModel {
	schema?: OpenAPIV3_1.SchemaObject;
	model?: Model;
}

interface MediaSchemaModel extends SchemaModel {
	mediaType: string;
}

interface ParamSchemaModel extends SchemaModel {
	jsonPath: string;
	ignore: boolean;
	param: OpenAPIV3_1.ParameterObject;
}

interface RequestSchemaModel {
	jsonPath: string;
	request?: OpenAPIV3_1.RequestBodyObject;
	schemaModels: MediaSchemaModel[];
}

type ResponseSchemaModel = {
	jsonPath: string;
	code: string;
	response: OpenAPIV3_1.ResponseObject
	schemaModels: MediaSchemaModel[]
}[]

export class LangNeutralGenerator extends OpenAPIV3_1Visitor {
	constructor(protected container: Container) {
		super();
	}

	protected apis: Api[];
	protected models: Model[];
	// The document we are processing.
	protected activeDoc: OpenAPIV3_1.Document;
	// Keeps us from getting caught in circular refs.
	protected seenJsonPaths: Set<string>;
	// Ensure we only visit schema once.
	protected seenSchema: Set<OpenAPIV3_1.SchemaObject>;
	// This all counts on the fact that we visit PathItems, Operations, RequestBody, Responses in exactly that order.
	/**
	 * PathItem params are shared across methods, so only 'visitPathItem' sets/clears this property.
	 * This allows us to associate the correct schema/model without 'visitSchema' having to track where we are at.
	 * If this is defined, and nothing else is, then 'visitSchema' must be processing a PathItem.
	 */
	protected activePathItemParams: ParamSchemaModel[];
	/**
	 * Operation params are unique to an operation, so 'visitOperation' sets/clears this property.
	 * So if this is defined (and neither 'activeOpRequest' nor 'activeOpResponse' is), 'visitSchema' must be processing an Operation param.
	 */
	protected activeOpParams: ParamSchemaModel[];
	/**
	 * Only 'visitRequestBody' sets this property (it is cleared by 'visitOperation').
	 * So if this is defined (and 'activeOpResponse' is not), 'visitSchema' must be processing a request body content type.
	 */
	protected activeOpRequest: RequestSchemaModel;
	/**
	 * Only 'visitResponse' sets this property (it is cleared by 'visitOperation').
	 * So if this is defined, 'visitSchema' must be processing a response body content type.
	 */
	protected activeOpResponse: ResponseSchemaModel;

	/**
	 * @inheritDoc
	 * However, this subclass operates on a fully resolved document, so 'obj' will never be an actual OpenAPI reference.
	 * All that matters to us is whether we have seen the object.
	 * If we have not seen it, invoke the callback.
	 * If we have seen it, we simply return.
	 */
	protected resolve<T extends object>(obj: T, cb: (obj: T) => boolean | void): boolean | void {
		const jp = this.activeJsonPath;
		if (this.seenJsonPaths.has(jp))
			return;
		this.seenJsonPaths.add(jp);
		return cb(obj as T);
	}

	public async generate(doc: OpenAPIV3_1.Document, ignoreUnusedModels?: boolean): Promise<{ models: Model[], apis: Api[] }> {
		const parser = new SwaggerParser();
		const refs = await parser.resolve(doc);
		this.activeDoc = await parser.dereference(doc) as OpenAPIV3_1.Document;
		// Give any top level schemas that do not already have a name, a default one.
		Object.keys(this.activeDoc.components.schemas).forEach(key => {
			const s = this.activeDoc.components.schemas[key];
			if (!s.title)
				if (!(s as any)['x-schema-name'])
					(s as any)['x-schema-name'] = key;
		});
		this.apis = [];
		this.models = [];
		this.seenJsonPaths = new Set();
		this.seenSchema = new Set();
		this.visit(doc, (ref: OpenAPIV3_1.ReferenceObject) => refs.get(ref.$ref), ignoreUnusedModels ? null : false);
		this.seenSchema.clear();
		this.seenJsonPaths.clear();
		delete this.activeDoc;
		return {
			models: this.models,
			apis: this.apis.filter(a => a.methods.length > 0)
		};
	}

	visitPathItem(pathItem: OpenAPIV3_1.PathItemObject): true | void {
		this.activePathItemParams = [];
		try {
			return super.visitPathItem(pathItem);
		}
		finally {
			delete this.activePathItemParams;
		}
	}

	visitSchema(schema: OpenAPIV3_1.SchemaObject, parent?: OpenAPIV3_1.SchemaObject): boolean | void {
		let created = false;
		let model: BaseSchemaModel;
		if (!this.seenSchema.has(schema)) {
			if ((schema as any)['x-oag-type']) {
				model = this.container.get<BaseTypedModel>(CodeGenTypedModelToken);
				model.init(this.activeDoc, this.activeJsonPath, schema);
				(model as BaseTypedModel).addOagType((schema as any)['x-oag-type']);
			}
			else {
				let schemaType = schema.type;
				if (!schemaType) {
					if (typeof (schema as OpenAPIV3_1.ArraySchemaObject).items !== 'undefined')
						schemaType = 'array';
					else if (typeof schema.properties !== 'undefined' || typeof schema.additionalProperties !== 'undefined' || typeof schema.discriminator !== 'undefined')
						schemaType = 'object';
					else if (Array.isArray(schema.enum)) {
						switch (typeof schema.enum[0]) {
							case 'string':
								schemaType = 'string';
								break;
							case 'number':
								schemaType = schema.enum.every(e => Number.isInteger(e)) ? 'integer' : 'number';
								break;
							case 'boolean':
								schemaType = 'boolean';
								break;
						}
					}
				}

				// allOf (aka &) is by definition a record/object.
				if (Array.isArray(schema.allOf)) {
					model = this.container.get<BaseRecordModel>(CodeGenRecordModelToken);
					model.init(this.activeDoc, this.activeJsonPath, schema);
					// We will pick up the rest of the initialization after our super method has done its thing.
				}
				// an array of types is by definition anyOf (aka |).  However, given our approach to null, anyOf may reduce to a simple "nullable" primitive.
				else if (schemaType && Array.isArray(schemaType)) {
					// OpenAPI will not allow "ambiguous" mixed types.
					// Meaning...
					// ['object', 'string', 'number', 'null'] would be legal.
					// ['object', 'array', 'boolean'] would also be legal, BUT *only* if no 'items' *or* 'properties' defined in the schema.
					// [what-ever-single-thing, 'null'] is always legal.
					const nullCount = schemaType.includes('null') ? 1 : 0;
					const hasObj = schemaType.includes('object');
					const hasArray = schemaType.includes('array');
					if (hasObj && (!hasArray)) {
						if (schemaType.length === 1 + nullCount) {
							model = this.container.get<BaseSchemaModel>(CodeGenRecordModelToken);
							model.init(this.activeDoc, this.activeJsonPath, schema);
						}
					}
					else if (hasArray && (!hasObj)) {
						if (schemaType.length === 1 + nullCount) {
							model = this.container.get<BaseSchemaModel>(CodeGenArrayModelToken);
							model.init(this.activeDoc, this.activeJsonPath, schema);
						}
					}
					else if (schemaType.length === 1 + nullCount) {
						const nonNullType = schemaType.find(s => s !== 'null');
						model = this.container.get(CodeGenCommonModelsToken)(nonNullType) as BaseSchemaModel;
						model.init(this.activeDoc, this.activeJsonPath, schema);
					}
					if (!model) {
						model = this.container.get<BaseUnionModel>(CodeGenUnionModelToken);
						model.init(this.activeDoc, this.activeJsonPath, schema);
						const unions = schemaType.filter(v => v !== 'null').map(v => this.container.get(CodeGenCommonModelsToken)(v as CommonModelTypes));
						unions.forEach(u => (u as BaseUnionModel).addUnion(u));
					}
				}
				else {
					let key: string;
					let constraints: Record<string, string | number | boolean>;
					const asUnion = (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) || (Array.isArray(schema.oneOf) && schema.oneOf.length > 0);
					switch (schemaType) {
						case 'object':
							if (!asUnion && !schema.additionalProperties && Object.keys(schema.properties ?? {}).length == 0)
								model = this.container.get(CodeGenCommonModelsToken)(schemaType) as BaseSchemaModel;
							else
								model = this.container.get<BaseSchemaModel>(CodeGenRecordModelToken);
							break;
						case 'array':
							model = this.container.get<BaseSchemaModel>(CodeGenArrayModelToken);
							break;
						case 'boolean':
							key = schema.type as string ?? schemaType;
							break;
						case 'number':
							key = schema.type as string ?? schemaType;
							constraints = SchemaJsdConstraints(schema);
							switch (constraints.format) {
								case 'float':
								case 'double':
									key = constraints.format;
									break;
							}
							break;
						case 'string':
							key = schema.type as string ?? schemaType;
							constraints = SchemaJsdConstraints(schema);
							switch (constraints.format) {
								case 'binary':
								case 'byte':
								case 'date':
								case 'date-time':
								case 'uri':
								case 'uri-reference':
								case 'regex':
									key = constraints.format;
									break;
							}
							break;
						case 'integer':
							key = schema.type as string ?? schemaType;
							constraints = SchemaJsdConstraints(schema);
							switch (constraints.format) {
								case 'int32':
								case 'int64':
									key = constraints.format;
									break;
							}
							break;
						case 'null':
							key = schema.type as string;
							break;
						default:
							if (asUnion)
								model = this.container.get<BaseUnionModel>(CodeGenUnionModelToken);
							else {
								let constVal: string;
								if (schema.const === null)
									constVal = 'null';
								else if (Array.isArray(schema.const))
									constVal = JSON5.stringify(schema.const);
								else {
									switch (typeof schema.const) {
										case 'string':
											constVal = `'${schema.const}'`;
											break;
										case 'number':
											constVal = String(schema.const);
											break;
										case 'boolean':
											constVal = schema.const ? 'true' : 'false';
											break;
										case 'object':
											constVal = JSON5.stringify(schema.const);
											break;
										default:
											key = 'any';    // The absence of a type means it can be anything.
											break;
									}
								}
								if (constVal) {
									model = this.container.get<BaseTypedModel>(CodeGenTypedModelToken);
									(model as BaseTypedModel).addOagType({literal: {type: constVal, lib: undefined}});
								}
							}
							break;
					}
					// No supported language can handle not, so it is effectively 'any'
					if ((!key) && (schema.not))
						key = 'any';
					if (key) {
						model = this.container.get(CodeGenCommonModelsToken)(key as CommonModelTypes) as BaseSchemaModel;
						if (asUnion) {
							// will init the union model below
							model.init(this.activeDoc, this.activeJsonPath, schema);
							const u = this.container.get<BaseUnionModel>(CodeGenUnionModelToken);
							u.addUnion(model);
							model = u;
						}
					}
					model.init(this.activeDoc, this.activeJsonPath, schema);
				}
			}
			if (!model)
				throw new Error('NOT IMPLEMENTED');
			if (model.getIdentifier('intf'))
				this.models.push(model);
			(schema as any)[CodeGenAst] = model;
			created = true;
			this.seenSchema.add(schema);
		}
		else if ((schema as any)[CodeGenAst])
			model = (schema as any)[CodeGenAst];

		if (!parent) {
			let activeParams: ParamSchemaModel[];
			// This chain is very important and reflects the fact that each of
			// these properties is *only* created once we are inside the associated record.
			// So activePathItemParams is only defined when we are actually inside a PathItem record.
			// activeOpParams is only defined when we are inside an operation.
			// activeOpRequest is only defined when we are inside a RequestBody.
			// etc.
			// This strategy allows us to assign the schema and model to the appropriate location.
			// and to be able to count on the state of the 'docPath'
			if (this.activeOpResponse?.length > 0) {
				this.activeOpResponse.at(-1).schemaModels.push({
					mediaType: this.docPath.at(-2) as string,
					schema: schema,
					model: model
				});
			}
			else if (this.activeOpRequest) {
				this.activeOpRequest.schemaModels.push({
					mediaType: this.docPath.at(-2) as string,
					schema: schema,
					model: model
				});
			}
			else if (this.activeOpParams)
				activeParams = this.activeOpParams;
			else if (this.activePathItemParams)
				activeParams = this.activePathItemParams;
			if (activeParams?.length > 0) {
				activeParams.at(-1).schema = schema;
				activeParams.at(-1).model = model;
			}
		}
		if (created)
			return super.visitSchema(schema, parent);
	}

	/**
	 * We never return a skip (false) or abort (true) from our schema visitations, so we will always get resolved schema (no refs).
	 */
	override processSchemaJoins(schema: OpenAPIV3_1.SchemaObject, allOf?: OpenAPIV3_1.SchemaObject[], oneOf?: OpenAPIV3_1.SchemaObject[], anyOf?: OpenAPIV3_1.SchemaObject[], _notSchema?: OpenAPIV3_1.SchemaObject) {
		const model = (schema as any)[CodeGenAst] as (BaseUnionModel | BaseRecordModel);
		if (Array.isArray(allOf)) {
			const brm = model as BaseRecordModel;
			allOf.forEach(u => {
				const um = (u as any)[CodeGenAst] as Model;
				// 'any' which can happen when no type is present, really has no meaning with 'allOf' as it imposes no *additional* constraints.
				if (isPrimitiveModel(um))
					if (um.jsdType === 'any')
						return;
				brm.addExtendsFrom(um);
			});
		}
		if (Array.isArray(oneOf))
			oneOf.forEach(u => model.addUnion((u as any)[CodeGenAst]));
		if (Array.isArray(anyOf))
			anyOf.forEach(u => model.addUnion((u as any)[CodeGenAst]));
	}

	visitSchemaProperty(schema: OpenAPIV3_1.SchemaObject, parent: OpenAPIV3_1.SchemaObject): boolean | void {
		const propName = this.docPath[this.docPath.length - 1] as string;
		try {
			return super.visitSchemaProperty(schema, parent);
		}
		finally {
			const schemaModel = (schema as OpenApiSchemaWithModelRef)[CodeGenAst];
			const parentModel = (parent as OpenApiSchemaWithModelRef)[CodeGenAst] as BaseRecordModel;
			parentModel.addProperty(propName, schemaModel, !!parent.required?.includes(propName));
		}
	}

	visitSchemaItems(schema: OpenAPIV3_1.SchemaObject, parent: OpenAPIV3_1.SchemaObject): boolean | void {
		try {
			return super.visitSchemaItems(schema, parent);
		}
		finally {
			const schemaModel = (schema as OpenApiSchemaWithModelRef)[CodeGenAst];
			const parentModel = (parent as OpenApiSchemaWithModelRef)[CodeGenAst] as BaseArrayModel;
			parentModel.setItems(schemaModel);
		}
	}

	visitAdditionalProperties(schema: OpenAPIV3_1.SchemaObject | boolean, parent: OpenAPIV3_1.SchemaObject) {
		const retVal = super.visitAdditionalProperties(schema, parent);
		if (typeof retVal === 'undefined') {
			let schemaModel: Model;
			if (typeof schema === 'boolean' && schema)
				schemaModel = this.container.get(CodeGenCommonModelsToken)('ANY');
			else if (schema && (schema as OpenApiSchemaWithModelRef)[CodeGenAst])
				schemaModel = (schema as OpenApiSchemaWithModelRef)[CodeGenAst];
			if (schemaModel) {
				const parentModel = (parent as OpenApiSchemaWithModelRef)[CodeGenAst] as BaseRecordModel;
				parentModel.setAdditionalProperties(schemaModel);
			}
		}
	}

	visitTag(tag: OpenAPIV3_1.TagObject): boolean | void {
		const settings = this.container.get(BaseSettingsToken);
		const ignore = (tag as any)['x-ignore'] || (tag as any)[`x-ignore-${settings.role}`]
		if (!ignore) {
			const api = this.container.get<BaseApi>(CodeGenApiToken);
			api.init(this.activeDoc, this.activeJsonPath, tag);
			this.apis.push(api);
		}
		return super.visitTag(tag);
	}

	visitOperation(operation: OpenAPIV3_1.OperationObject): boolean | void {
		const opJsonPath = this.activeJsonPath;
		this.activeOpResponse = [];
		this.activeOpParams = [];
		try {
			const retVal = super.visitOperation(operation);
			if (typeof retVal === 'undefined') {
				const settings = this.container.get(BaseSettingsToken);
				if ((operation as any)['x-ignore'] || (operation as any)[`x-ignore-${settings.role}`])
					return retVal;
				if (operation.tags && Array.isArray(operation.tags) && operation.tags.length > 0) {
					const api = operation.tags.map((t) => {
						const otName = nameUtils.snakeCase(t);
						return this.apis.find(api => nameUtils.snakeCase(api.oae.name) === otName);
					}).find(e => !!e) as BaseApi;
					if (api) {
						const piJP = opJsonPath.substring(0, opJsonPath.lastIndexOf('/'));
						const pi = this.resolver({$ref: piJP}) as OpenAPIV3_1.PathItemObject;
						const method = this.container.get<BaseMethod>(CodeGenMethodToken);
						method.init(this.activeDoc, opJsonPath, operation, pi);
						this.processMethod(method);
						api.addMethod(method);
					}
				}
			}
		}
		finally {
			delete this.activeOpParams;
			delete this.activeOpRequest;
			delete this.activeOpResponse;
			// Don't nuke activePathItemParams, that is the responsibility of 'visitPathItem' as it is *shared* across methods.
		}
	}

	visitParameter(parameter: OpenAPIV3_1.ParameterObject): boolean | void {
		const settings = this.container.get(BaseSettingsToken);
		const ignore = (parameter as any)['x-ignore'] || (parameter as any)[`x-ignore-${settings.role}`];
		if (this.activeOpParams)
			this.activeOpParams.push({
				ignore: ignore,
				jsonPath: this.activeJsonPath,
				param: parameter
			});
		else if (this.activePathItemParams)
			this.activePathItemParams.push({
				ignore: ignore,
				jsonPath: this.activeJsonPath,
				param: parameter
			});
		return super.visitParameter(parameter);
	}

	visitRequestBody(body: OpenAPIV3_1.RequestBodyObject): boolean | void {
		this.activeOpRequest = {
			jsonPath: this.activeJsonPath,
			request: body,
			schemaModels: [] as any
		};
		return super.visitRequestBody(body);
	}

	visitResponse(rsp: OpenAPIV3_1.ResponseObject): boolean | void {
		// Remember, 'components' has a shared/global responses section, so we would not be processing a method at that time.
		if (Array.isArray(this.activeOpResponse)) {
			const jp = this.activeJsonPath;
			this.activeOpResponse.push({
				jsonPath: jp,
				code: jp.substring(jp.lastIndexOf('/') + 1),
				response: rsp,
				schemaModels: [] as any
			});
		}
		return super.visitResponse(rsp);
	}

	protected processMethod(method: BaseMethod) {
		const oaOp = method.oae;
		if (Object.keys(oaOp.responses).length !== this.activeOpResponse.length)
			throw new RangeError('Parser error tracking operation responses');
		let clientSettings: ClientSettingsType;
		if (this.container.isIdKnown(ClientSettingsToken))
			clientSettings = this.container.get(ClientSettingsToken);

		// Make a NamedParameter for each "shared" parameter (if any) that we collected for the current PathItem.
		const opParams = (this.activePathItemParams ?? []).filter(p => !p.ignore).map(p => {
			const param = this.container.get<BaseNamedParameter>(CodeGenNamedParameterToken);
			param.init(this.activeDoc, p.jsonPath, p.param, p.model);
			return param;
		}) as Parameter[];
		// Make a NamedParameter for each parameter (if any) that we collected for this operation.
		(this.activeOpParams ?? []).reduce((r, p) => {
			if (!p.ignore) {
				const param = this.container.get<BaseNamedParameter>(CodeGenNamedParameterToken);
				param.init(this.activeDoc, p.jsonPath, p.param, p.model);
				r.push(param);
			}
			return r;
		}, opParams);

		// If this operation had a request body, build a Model to represent that and
		// add it to as a BodyParameter.
		if (this.activeOpRequest) {
			let model: Model;
			let preferredMT: string[];
			if (this.activeOpRequest.schemaModels.length > 0) {
				let bodySchemaModels = this.activeOpRequest.schemaModels;
				if (clientSettings) {
					// We list body types for client code generation, in an order of preference.
					const specifiedTypes = bodySchemaModels.map(e => e.mediaType);
					preferredMT = this.preferredMediaTypes(clientSettings.reqMediaTypes, specifiedTypes);
					bodySchemaModels = bodySchemaModels.filter(e => preferredMT.includes(e.mediaType));
				}
				bodySchemaModels = this.consolidateMatchingSchema(bodySchemaModels);
				model = this.aggregateModels(bodySchemaModels.map(e => e.model));
			}
			else {
				// A request body with no schema defined we interpret to mean 'ANY'.
				// It could perhaps mean void, but in that case it should be removed from the specification.
				model = this.container.get(CodeGenCommonModelsToken)('ANY');
			}
			const otherNames = opParams.map(p => p.getIdentifier('intf'));
			const body = this.container.get<BaseBodyParameter>(CodeGenBodyParameterToken);
			body.init(this.activeDoc, this.activeOpRequest.jsonPath, this.activeOpRequest.request, model, otherNames, preferredMT);
			opParams.push(body);
		}
		// Using a stable sort, ensure all required params come before optional params.
		// Also ensure the body 'param' is last in its group (required or optional).
		// Then add all the params to the method.
		opParams.sort((a, b) => {
			if (a.required === b.required) {
				// // body is always last.
				if (a.kind === 'body')
					return 1;
				else if (b.kind === 'body')
					return -1;
				return 0;
			}
			return a.required ? -1 : 1;
		}).forEach(p => method.addParameter(p));

		// Order our responses in (what we consider to be) an optimal ordering.
		const rspCodes = this.activeOpResponse.map(e => e.code);
		const hasOk = rspCodes.some(c => c.startsWith('2') || c.startsWith('d') || c.startsWith('D'));
		if (!hasOk) {
			// Method's always have a "success" return type, but the schema does not define one (e.g. what will be returned is unknown).
			const rsp = this.container.get<BaseOpenApiResponse>(CodeGenOpenApiResponseToken);
			rsp.init(this.activeDoc, undefined, undefined, this.container.get(CodeGenCommonModelsToken)('UNKNOWN'));
			method.addResponse('2XX', rsp);
		}
		const preferredRspCodes = this.preferredResponseCodes(method.httpMethod, rspCodes);
		const opResponses = this.activeOpResponse.slice().sort((a, b) => preferredRspCodes.indexOf(a.code) - preferredRspCodes.indexOf(b.code));
		opResponses.forEach(r => {
			let model: Model;
			if (r.schemaModels.length > 0) {
				let schemaModels = r.schemaModels;
				if (clientSettings) {
					// We list body types for client code generation, in an order of preference.
					const specifiedTypes = schemaModels.map(e => e.mediaType);
					const preferredMT = this.preferredMediaTypes(clientSettings.reqMediaTypes, specifiedTypes);
					schemaModels = schemaModels.filter(e => preferredMT.includes(e.mediaType)).sort((a, b) => preferredMT.indexOf(a.mediaType) - preferredMT.indexOf(b.mediaType));
				}
				schemaModels = this.consolidateMatchingSchema(schemaModels);
				model = this.aggregateModels(schemaModels.map(e => e.model));
			}
			else {
				// A response with no schema defined means the response body is void (e.g. does not exist).
				model = this.container.get(CodeGenCommonModelsToken)('VOID');
			}
			const rsp = this.container.get<BaseOpenApiResponse>(CodeGenOpenApiResponseToken);
			rsp.init(this.activeDoc, r.jsonPath, r.response, model);
			method.addResponse(r.code, rsp);
		});
	}

	/**
	 * Helper to filter and sort the provided mediaTypes according to our configuration.
	 * The real purpose of this header is to suggest a request body Content-Type for code generators,
	 * AND,
	 * to propose an Accept header for code generators.
	 * Of course, code generators *should* also append * / * and handle unpredictable responses.
	 */
	protected preferredMediaTypes(preferredTypes: string[], mediaTypes: string[]): string[] {
		mediaTypes = Array.from(new Set(mediaTypes));
		const allowedTypes = mediaTypes.filter(k => preferredTypes.find(p => this.mediaTypeMatcher(p, k)));
		return allowedTypes.sort((a, b) => {
			// noinspection SpellCheckingInspection
			const aidx = preferredTypes.findIndex(p => this.mediaTypeMatcher(p, a));
			// noinspection SpellCheckingInspection
			const bidx = preferredTypes.findIndex(p => this.mediaTypeMatcher(p, b));
			return aidx - bidx;
		});
	}

	/**
	 * Helper to match a wildcard pattern to a mediaType
	 */
	private mediaTypeMatcher(pattern: string, mediaType: string) {
		const lmt = mediaType.toLowerCase();
		// noinspection SpellCheckingInspection
		const lpat = pattern.toLowerCase();
		// noinspection SpellCheckingInspection
		const lpata = lpat.split(/[\r\n\s]+/);
		if (Array.isArray(lpata) && lpata[0] !== pattern) {
			const regex = new RegExp(lpata[0], lpata[1] ?? '');
			return regex.test(lmt);
		}
		return lpat === lmt;
	}

	/**
	 * Combine a given set of models in the specified way
	 */
	protected aggregateModels(models: Model[]): Model {
		if (models.length === 1)
			return models[0];
		const model = this.container.get<BaseUnionModel>(CodeGenUnionModelToken);
		models.forEach(m => model.addUnion(m));
		return model;
	}

	/**
	 * Return a filtered list of MediaSchemaModel that are unique from an array of potential duplicates.
	 */
	protected consolidateMatchingSchema(schemaModels: MediaSchemaModel[]): MediaSchemaModel[] {
		if (schemaModels.length === 1)
			return schemaModels;
		const unique = new Set<MediaSchemaModel>();
		for (let sm of schemaModels) {
			let isDuplicate = false;
			for (let elem of unique)
				if (elem.model.modelsMatch(sm.model)) {
					isDuplicate = true;
					break;
				}
			if (!isDuplicate)
				unique.add(sm);
		}
		return Array.from(unique);
	}

	/**
	 * Helper method to compute an ordered list of the most preferred http status response codes.
	 * The purpose of this is to assist in declaring the return type for a 'body' overloaded METHOD.
	 */
	protected preferredResponseCodes(method: string, responseCodes: string[]): string[] {
		responseCodes = Array.from(new Set(responseCodes));
		// Don't get tripped up by casing or other syntax issues
		const caseMap = responseCodes.reduce((p, v) => {
			let k = v.toUpperCase();
			// This will place default before 300+ but after 299
			if (k === 'DEFAULT')
				k = '2ZZ';
			k = k.padEnd(3, 'X');
			p[k] = v;
			return p;
		}, {} as Record<string, string>);
		// Only return success codes for the body overload (client apis should always have an HttpResponse return type to access the full response).
		const successCodes = Object.keys(caseMap).sort().map(s => s === '2ZZ' ? 'default' : s);

		// If an element exists in the provided array, pull it to the front of that array.
		function pullForward(s: string, a: string[]) {
			let idx = a.indexOf(s);
			if (idx >= 0)
				a.unshift(a.splice(idx, 1)[0]);
		}

		// IANA spec has some opinions about status codes that different methods *should* return.
		switch (method.toUpperCase()) {
			case 'HEAD':
			case 'GET':
				pullForward('204', successCodes);
				pullForward('200', successCodes);
				break;
			case 'POST':
				pullForward('200', successCodes);
				pullForward('201', successCodes);
				break;
			case 'PUT':
				pullForward('204', successCodes);
				pullForward('200', successCodes);
				pullForward('201', successCodes);
				break;
			case 'DELETE':
				pullForward('200', successCodes);
				pullForward('204', successCodes);
				pullForward('202', successCodes);
				break;
		}
		return successCodes;
	}
}
