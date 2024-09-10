import SwaggerParser from '@apidevtools/swagger-parser';
import {Container} from 'async-injection';
import {Api, CodeGenApiToken} from 'oag-shared/lang-neutral/api';
import {ArrayModel, CodeGenArrayModelToken, CodeGenCommonModelsToken, CodeGenPrimitiveModelToken, CodeGenRecordModelToken, Model, RecordModel} from 'oag-shared/lang-neutral/model';
import {AbsParameter} from 'oag-shared/lang-neutral/parameter';
import {OpenAPIV3_1Visitor} from 'oag-shared/openapi/document-visitor';
import * as nameUtils from 'oag-shared/utils/name-utils';
import {OpenAPIV3_1} from 'openapi-types';
import {BaseMethod, BaseMethodToken} from './generators/base-method';
import {BaseArrayModel, BaseModel, BaseRecordModel} from './generators/base-model';
import {BaseBodyParameterToken, BaseNamedParameterToken} from './generators/base-parameter';
import {BaseResponseToken} from './generators/base-response';
import {ClientSettingsToken, ClientSettingsType} from './settings/client';

const MODEL_LN = Symbol('model');

interface SchemaModel {
	schema?: OpenAPIV3_1.SchemaObject;
	model?: Model;
}

interface MediaSchemaModel extends SchemaModel {
	mediaType: string;
}

interface ParamSchemaModel extends SchemaModel {
	jsonPath: string;
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
	 * So if this is defined (and 'activeOpResponse' is not), 'visitSchema' must be processing an request body content type.
	 */
	protected activeOpRequest: RequestSchemaModel;
	/**
	 * Only 'visitResponse' sets this property (it is cleared by 'visitOperation').
	 * So if this is defined, 'visitSchema' must be processing an response body content type.
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
			apis: this.apis
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
		let model: BaseModel;
		if (schema.type && Array.isArray(schema.type)) {
			throw new Error('NOT IMPLEMENTED');
		}
		else {
			switch (schema.type) {
				case 'object':
					model = this.container.get<BaseModel>(CodeGenRecordModelToken);
					break;
				case 'array':
					model = this.container.get<BaseModel>(CodeGenArrayModelToken);
					break;
				case 'boolean':
				case 'number':
				case 'string':
				case 'integer':
				case 'null':
					model = this.container.get(CodeGenCommonModelsToken)[schema.type] as BaseModel;
					break;
				default:
			}
			model.init(this.activeDoc, this.activeJsonPath, schema);
			(schema as any)[MODEL_LN] = model;
			if (model.getIdentifier('intf'))
				this.models.push(model);
		}
		if (!model)
			throw new Error('NOT IMPLEMENTED');

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
			if (this.activeOpResponse) {
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

		if (this.seenSchema.has(schema))
			return;
		this.seenSchema.add(schema);
		return super.visitSchema(schema, parent);
	}

	visitSchemaProperty(schema: OpenAPIV3_1.SchemaObject, parent: OpenAPIV3_1.SchemaObject): boolean | void {
		const propName = this.docPath[this.docPath.length - 1] as string;
		try {
			return super.visitSchemaProperty(schema, parent);
		}
		finally {
			const schemaModel = (schema as any)[MODEL_LN] as Model;
			const parentModel = (parent as any)[MODEL_LN] as RecordModel;
			parentModel.addProperty(propName, schemaModel, !!parent.required?.includes(propName));
		}
	}

	visitSchemaItems(schema: OpenAPIV3_1.SchemaObject, parent: OpenAPIV3_1.SchemaObject): boolean | void {
		try {
			return super.visitSchemaItems(schema, parent);
		}
		finally {
			const schemaModel = (schema as any)[MODEL_LN] as Model;
			const parentModel = (parent as any)[MODEL_LN] as BaseArrayModel;
			parentModel.setItems(schemaModel);
		}
	}

	visitAdditionalProperties(schema: OpenAPIV3_1.SchemaObject | boolean, parent: OpenAPIV3_1.SchemaObject) {
		try {
			return super.visitAdditionalProperties(schema, parent);
		}
		finally {
			let schemaModel: Model;
			if (typeof schema === 'boolean'  && schema)
				schemaModel = this.container.get(CodeGenCommonModelsToken)['any'];
			else if (schema && (schema as any)[MODEL_LN])
				schemaModel = (schema as any)[MODEL_LN] as Model;
			if (schemaModel) {
				const parentModel = (parent as any)[MODEL_LN] as BaseRecordModel;
				parentModel.setAdditionalProperties(schemaModel);
			}
		}
	}

	visitTag(tag: OpenAPIV3_1.TagObject): boolean | void {
		const api = this.container.get(CodeGenApiToken);
		api.init(this.activeDoc, this.activeJsonPath, tag);
		this.apis.push(api);
		return super.visitTag(tag);
	}

	visitOperation(operation: OpenAPIV3_1.OperationObject): boolean | void {
		const opJsonPath = this.activeJsonPath;
		this.activeOpParams = [];
		try {
			return super.visitOperation(operation);
		}
		finally {
			if (operation.tags && Array.isArray(operation.tags) && operation.tags.length > 0) {
				const api = operation.tags.map((t) => {
					const otName = nameUtils.snakeCase(t);
					return this.apis.find(api => nameUtils.snakeCase(api.oae.name) === otName);
				}).find(e => !!e);
				if (api) {
					const piJP = opJsonPath.substring(0, opJsonPath.lastIndexOf('/'));
					const pi = this.resolver({$ref: piJP}) as OpenAPIV3_1.PathItemObject;
					const method = this.container.get(BaseMethodToken);
					method.init(this.activeDoc, opJsonPath, operation, pi);
					this.processMethod(method);
					api.addMethod(method);
				}
			}
			delete this.activeOpParams;
			delete this.activeOpRequest;
			delete this.activeOpResponse;
			// Don't nuke activePathItemParams, that is the responsibility of 'visitPathItem' as it is *shared* across methods.
		}
	}

	visitParameter(parameter: OpenAPIV3_1.ParameterObject): boolean | void {
		if (this.activeOpParams)
			this.activeOpParams.push({
				jsonPath: this.activeJsonPath,
				param: parameter
			});
		else if (this.activePathItemParams)
			this.activePathItemParams.push({
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
		this.activeOpResponse = this.activeOpResponse || [] as any;
		const jp = this.activeJsonPath;
		this.activeOpResponse.push({
			jsonPath: jp,
			code: jp.substring(jp.lastIndexOf('/') + 1),
			response: rsp,
			schemaModels: [] as any
		});
		return super.visitResponse(rsp);
	}

	protected processMethod(method: BaseMethod) {
		let clientSettings: ClientSettingsType;
		if (this.container.isIdKnown(ClientSettingsToken))
			clientSettings = this.container.get(ClientSettingsToken);

		// Make a NamedParameter for each "shared" parameter (if any) that we collected for the current PathItem.
		const opParams = (this.activePathItemParams ?? []).map(p => {
			const param = this.container.get(BaseNamedParameterToken);
			param.init(this.activeDoc, p.jsonPath, p.param);
			param.setModel(p.model);
			return param;
		}) as AbsParameter<OpenAPIV3_1.ParameterObject | OpenAPIV3_1.RequestBodyObject>[];
		// Make a NamedParameter for each parameter (if any) that we collected for this operation.
		(this.activeOpParams ?? []).reduce((r, p) => {
			const param = this.container.get(BaseNamedParameterToken);
			param.init(this.activeDoc, p.jsonPath, p.param);
			param.setModel(p.model);
			r.push(param);
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
				model = this.aggregateModels(bodySchemaModels.map(e => e.model), `union`);
			}
			else {
				// A request body with no schema defined we interpret to mean 'any'.
				// It could perhaps mean void, but in that case it should be removed from the specification.
				model = this.container.get(CodeGenCommonModelsToken)['any'];
			}
			const otherNames = opParams.map(p => p.getIdentifier('intf'));
			const body = this.container.get(BaseBodyParameterToken);
			body.init(this.activeDoc, this.activeOpRequest.jsonPath, this.activeOpRequest.request, otherNames, preferredMT);
			body.setModel(model);
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
		const preferredRspCodes = this.preferredResponseCodes(method.httpMethod, this.activeOpResponse.map(e => e.code));
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
				model = this.aggregateModels(schemaModels.map(e => e.model), `union`);
			}
			else {
				// A response with no schema defined means the response body is void (e.g. does not exist).
				model = this.container.get(CodeGenCommonModelsToken)['void'];
			}
			const rsp = this.container.get(BaseResponseToken);
			rsp.init(this.activeDoc, r.jsonPath, r.response);
			rsp.setModel(model);
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
	protected aggregateModels(map: Model[], way: 'union' | 'intersection' | 'discriminated'): Model {
		if (map.length === 1)
			return map[0];
		throw new Error('NOT IMPLEMENTED');
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
				if (elem.model.matches(sm.model)) {
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
