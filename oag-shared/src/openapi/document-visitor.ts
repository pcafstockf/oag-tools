import {OpenAPIV3, OpenAPIV3_1} from 'openapi-types';
import {HttpLowerVerbs} from '../utils/http-utils';

export class DocumentVisitor<
	DOCUMENT extends (OpenAPIV3.Document | OpenAPIV3_1.Document) = OpenAPIV3_1.Document,
	PATHS extends (OpenAPIV3.PathsObject | OpenAPIV3_1.PathsObject) = OpenAPIV3_1.PathsObject,
	PATHITEM extends (OpenAPIV3.PathItemObject | OpenAPIV3_1.PathItemObject) = OpenAPIV3_1.PathItemObject,
	OPERATION extends (OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject) = OpenAPIV3_1.OperationObject,
	PARAMETER extends (OpenAPIV3.ParameterObject | OpenAPIV3_1.ParameterObject) = OpenAPIV3_1.ParameterObject,
	REQBODY extends (OpenAPIV3.RequestBodyObject | OpenAPIV3_1.RequestBodyObject) = OpenAPIV3_1.RequestBodyObject,
	MEDIATYPE extends (OpenAPIV3.MediaTypeObject | OpenAPIV3_1.MediaTypeObject) = OpenAPIV3_1.MediaTypeObject,
	ENCODING extends (OpenAPIV3.EncodingObject | OpenAPIV3_1.EncodingObject) = OpenAPIV3_1.EncodingObject,
	RESPONSE extends (OpenAPIV3.ResponseObject | OpenAPIV3_1.ResponseObject) = OpenAPIV3_1.ResponseObject,
	HEADER extends (OpenAPIV3.HeaderObject | OpenAPIV3_1.HeaderObject) = OpenAPIV3_1.HeaderObject,
	COMPONENTS extends (OpenAPIV3.ComponentsObject | OpenAPIV3_1.ComponentsObject) = OpenAPIV3_1.ComponentsObject,
	SCHEMA extends (OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject) = OpenAPIV3_1.SchemaObject,
	SECSCHEME extends (OpenAPIV3.SecuritySchemeObject | OpenAPIV3_1.SecuritySchemeObject) = OpenAPIV3_1.SecuritySchemeObject,
	TAG extends (OpenAPIV3.TagObject | OpenAPIV3_1.TagObject) = OpenAPIV3_1.TagObject,
	REFERENCE extends (OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject) = OpenAPIV3_1.ReferenceObject,
	RESULT extends (OpenAPIV3.Document | OpenAPIV3_1.Document) = OpenAPIV3_1.Document
> {
	constructor() {
		this.docPath = ['#'];
		this.resolver = () => true;
	}

	protected docPath: (string | { $ref: string })[];
	protected resolver: (ref: REFERENCE) => any;

	protected resolve<T extends object>(objOrRef: T | REFERENCE, cb: (obj: T) => boolean | void): boolean | void {
		if (typeof objOrRef === 'object' && '$ref' in objOrRef) {
			const obj = this.resolver(objOrRef) as T;
			if (obj) {
				this.docPath.push(Object.freeze({
					...objOrRef
				}) as REFERENCE);
				try {
					return cb(obj);
				}
				finally {
					this.docPath.pop();
				}
			}
		}
		else
			return cb(objOrRef as T);
	}

	get activeJsonPath(): string {
		let idx = this.docPath.findLastIndex(e => typeof e !== 'string');
		let jp = (this.docPath.slice(idx + 1) as string[]).map((seg: string) => seg.replaceAll('~', '~0').replaceAll('/', '~1')).join('/');
		if (idx > 0)
			jp = (this.docPath[idx] as REFERENCE).$ref + (jp ? '/' + jp : '');
		return jp;
	}

	visitPaths(paths: PATHS): boolean | void {
		for (const pattern in paths) {
			this.docPath.push(pattern);
			try {
				const result = this.inspectPathItem(paths[pattern] as PATHITEM);
				if (typeof result === 'boolean') {
					if (result)
						return true;
					break;
				}
			}
			finally {
				this.docPath.pop();
			}
		}
	}

	inspectPathItem(pathItem: PATHITEM | REFERENCE): boolean | void {
		return this.resolve(pathItem, (pi) => this.visitPathItem(pi));
	}

	visitPathItem(pathItem: PATHITEM): true | void {
		if (Array.isArray(pathItem.parameters)) {
			this.docPath.push('parameters');
			try {
				for (let idx = 0; idx < pathItem.parameters.length; idx++) {
					this.docPath.push(String(idx));
					try {
						const result = this.inspectParameter(pathItem.parameters[idx] as PARAMETER);
						if (typeof result === 'boolean') {
							if (result)
								return true;
							break;
						}
					}
					finally {
						this.docPath.pop();
					}
				}
			}
			finally {
				this.docPath.pop();
			}
		}
		const verbs = Object.keys(pathItem).filter(key => HttpLowerVerbs.includes(key.toLowerCase()));
		for (const verb of verbs) {
			this.docPath.push(verb);
			try {
				const result = this.visitOperation(pathItem[verb as OpenAPIV3.HttpMethods] as OPERATION);
				if (typeof result === 'boolean') {
					if (result)
						return true;
					break;
				}
			}
			finally {
				this.docPath.pop();
			}
		}
	}

	visitComponents(components: COMPONENTS, schemasLast?: boolean | null): boolean | void {
		if (components.securitySchemes) {
			this.docPath.push('securitySchemes');
			try {
				for (const key in components.securitySchemes) {
					this.docPath.push(key);
					try {
						const result = this.inspectSecurityScheme(components.securitySchemes[key] as SECSCHEME);
						if (typeof result === 'boolean') {
							if (result)
								return true;
							break;
						}
					}
					finally {
						this.docPath.pop();
					}
				}
			}
			finally {
				this.docPath.pop();
			}
		}
		const processSchemasFn = () => {
			if (components.schemas && schemasLast !== null) {
				this.docPath.push('schemas');
				try {
					for (const key in components.schemas) {
						this.docPath.push(key);
						try {
							const result = this.inspectSchema(components.schemas[key] as SCHEMA);
							if (typeof result.result === 'boolean') {
								if (result.result)
									return true;
								break;
							}
						}
						finally {
							this.docPath.pop();
						}
					}
				}
				finally {
					this.docPath.pop();
				}
			}
		};
		if (!schemasLast)
			processSchemasFn();

		if (components.parameters) {
			this.docPath.push('parameters');
			try {
				for (const param in components.parameters) {
					this.docPath.push(param);
					try {
						const result = this.inspectParameter(components.parameters[param] as PARAMETER);
						if (typeof result === 'boolean') {
							if (result)
								return true;
							break;
						}
					}
					finally {
						this.docPath.pop();
					}
				}
			}
			finally {
				this.docPath.pop();
			}
		}
		if (components.headers) {
			this.docPath.push('headers');
			try {
				for (const header in components.headers) {
					this.docPath.push(header);
					try {
						const result = this.inspectHeader(components.headers[header] as HEADER);
						if (typeof result === 'boolean') {
							if (result)
								return true;
							break;
						}
					}
					finally {
						this.docPath.pop();
					}
				}
			}
			finally {
				this.docPath.pop();
			}
		}
		if (components.requestBodies) {
			this.docPath.push('requestBodies');
			try {
				for (const key in components.requestBodies) {
					this.docPath.push(key);
					try {
						const result = this.inspectRequestBody(components.requestBodies[key] as REQBODY);
						if (typeof result === 'boolean') {
							if (result)
								return true;
							break;
						}
					}
					finally {
						this.docPath.pop();
					}
				}
			}
			finally {
				this.docPath.pop();
			}
		}
		if (components.responses) {
			this.docPath.push('responses');
			try {
				for (const code in components.responses) {
					this.docPath.push(String(code));
					try {
						const result = this.inspectResponse(components.responses[code] as RESPONSE);
						if (typeof result === 'boolean') {
							if (result)
								return true;
							break;
						}
					}
					finally {
						this.docPath.pop();
					}
				}
			}
			finally {
				this.docPath.pop();
			}
		}
		if (schemasLast)
			processSchemasFn();
	}

	inspectSecurityScheme(secScheme: SECSCHEME | REFERENCE): boolean | void {
		return this.resolve(secScheme, (s) => this.visitSecurityScheme(s));
	}

	// noinspection JSUnusedLocalSymbols
	visitSecurityScheme(secScheme: SECSCHEME): boolean | void {
	}

	visit(document: DOCUMENT, resolver: (ref: REFERENCE) => any, schemasLast?: boolean | null): RESULT | boolean {
		this.resolver = resolver;
		this.docPath = ['#'];
		if (Array.isArray(document.tags)) {
			this.docPath.push('tags');
			try {
				for (let idx = 0; idx < document.tags.length; idx++) {
					this.docPath.push(String(idx));
					try {
						const result = this.visitTag(document.tags[idx] as TAG);
						if (typeof result === 'boolean') {
							if (result)
								return true;
							break;
						}
					}
					finally {
						this.docPath.pop();
					}
				}
			}
			finally {
				this.docPath.pop();
			}
		}
		const processPathsFn = () => {
			if (document.paths) {
				this.docPath.push('paths');
				try {
					if (this.visitPaths(document.paths as PATHS))
						return true;
				}
				finally {
					this.docPath.pop();
				}
			}
		};
		const processComponentsFn = () => {
			if (document.components) {
				this.docPath.push('components');
				try {
					if (this.visitComponents(document.components as COMPONENTS, schemasLast))
						return true;
				}
				finally {
					this.docPath.pop();
				}
			}
		};

		if (schemasLast || schemasLast === null) {
			processPathsFn();
			processComponentsFn();
		}
		else {
			processComponentsFn();
			processPathsFn();
		}

		return document as unknown as RESULT;
	}

	// noinspection JSUnusedLocalSymbols
	visitTag(tag: TAG): boolean | void {
	}

	inspectHeader(header: HEADER | REFERENCE): boolean | void {
		return this.resolve(header, (hdr) => this.visitHeader(hdr));
	}

	visitHeader(header: HEADER): boolean | void {

	}

	inspectParameter(parameter: PARAMETER | REFERENCE): boolean | void {
		return this.resolve(parameter, (param) => this.visitParameter(param));
	}

	visitParameter(parameter: PARAMETER): boolean | void {
		// A parameter MUST contain either a schema property, or a content property, but not both.
		if (parameter.schema) {
			this.docPath.push('schema');
			try {
				const result = this.inspectSchema(parameter.schema as SCHEMA);
				if (result.result)
					return true;
			}
			finally {
				this.docPath.pop();
			}
		}
		else if (parameter.content) {
			this.docPath.push('content');
			try {
				const mediaType = Object.keys(parameter.content)[0];
				if (mediaType) {
					this.docPath.push(mediaType);
					try {
						return this.visitMediaType(parameter.content[mediaType] as MEDIATYPE);
					}
					finally {
						this.docPath.pop();
					}
				}
			}
			finally {
				this.docPath.pop();
			}
		}
	}

	visitOperation(operation: OPERATION): boolean | void {
		if (Array.isArray(operation.parameters)) {
			this.docPath.push('parameters');
			try {
				for (let idx = 0; idx < operation.parameters.length; idx++) {
					this.docPath.push(String(idx));
					try {
						const result = this.inspectParameter(operation.parameters[idx] as PARAMETER);
						if (typeof result === 'boolean') {
							if (result)
								return true;
							break;
						}
					}
					finally {
						this.docPath.pop();
					}
				}
			}
			finally {
				this.docPath.pop();
			}
		}
		if (operation.requestBody) {
			this.docPath.push('requestBody');
			try {
				if (this.inspectRequestBody(operation.requestBody as REQBODY))
					return;
			}
			finally {
				this.docPath.pop();
			}
		}

		this.docPath.push('responses');
		try {
			for (const code in operation.responses) {
				this.docPath.push(String(code));
				try {
					const result = this.inspectResponse(operation.responses[code] as RESPONSE);
					if (typeof result === 'boolean') {
						if (result)
							return true;
						break;
					}
				}
				finally {
					this.docPath.pop();
				}
			}
		}
		finally {
			this.docPath.pop();
		}
	}

	inspectResponse(response: RESPONSE | REFERENCE): boolean | void {
		return this.resolve(response, (rsp) => this.visitResponse(rsp));
	}

	visitResponse(rsp: RESPONSE): boolean | void {
		if (rsp.headers) {
			this.docPath.push('headers');
			try {
				for (const header in rsp.headers) {
					this.docPath.push(header);
					try {
						const result = this.inspectHeader(rsp.headers[header] as HEADER);
						if (typeof result === 'boolean') {
							if (result)
								return true;
							break;
						}
					}
					finally {
						this.docPath.pop();
					}
				}
			}
			finally {
				this.docPath.pop();
			}
		}
		if (rsp.content) {
			this.docPath.push('content');
			try {
				for (const mediaType in rsp.content) {
					this.docPath.push(mediaType);
					try {
						const result = this.visitMediaType(rsp.content[mediaType] as MEDIATYPE);
						if (typeof result === 'boolean') {
							if (result)
								return true;
							break;
						}
					}
					finally {
						this.docPath.pop();
					}
				}
			}
			finally {
				this.docPath.pop();
			}
		}
	}

	inspectRequestBody(requestBody: REQBODY | REFERENCE): boolean | void {
		return this.resolve(requestBody, (body) => this.visitRequestBody(body));
	}

	visitRequestBody(body: REQBODY): boolean | void {
		this.docPath.push('content');
		try {
			for (const content in body.content) {
				this.docPath.push(content);
				try {
					const result = this.visitMediaType(body.content[content] as MEDIATYPE);
					if (typeof result === 'boolean') {
						if (result)
							return true;
						break;
					}
				}
				finally {
					this.docPath.pop();
				}
			}
		}
		finally {
			this.docPath.pop();
		}
	}

	visitMediaType(mediaType: MEDIATYPE): boolean | void {
		let schema: SCHEMA | undefined;
		if (mediaType.schema) {
			this.docPath.push('schema');
			try {
				const result = this.inspectSchema(mediaType.schema as SCHEMA);
				if (result.result)
					return true;
				schema = result.schema;
			}
			finally {
				this.docPath.pop();
			}
		}
		if (mediaType.encoding) {
			this.docPath.push('encoding');
			try {
				for (const encoding in mediaType.encoding) {
					this.docPath.push(encoding);
					try {
						const result = this.visitEncoding(mediaType.encoding[encoding] as ENCODING, schema);
						if (typeof result === 'boolean') {
							if (result)
								return true;
							break;
						}
					}
					finally {
						this.docPath.pop();
					}
				}
			}
			finally {
				this.docPath.pop();
			}
		}
	}

	inspectSchema(schema: SCHEMA | REFERENCE, parent?: SCHEMA): { result?: boolean, schema?: SCHEMA } {
		let retVal: { result?: boolean, schema?: SCHEMA } = {};
		retVal.result = this.resolve(schema, (s) => {
			retVal.schema = s;
			return this.visitSchema(s, parent);
		}) as boolean;
		return retVal;
	}

	visitSchema(schema: SCHEMA, parent?: SCHEMA): boolean | void {
		if (Array.isArray(schema.type)) {
			this.docPath.push('type');
			try {
				for (let idx = 0; idx < schema.type.length; idx++) {
					this.docPath.push(String(idx));
					try {
						const result = this.visitSchemaType(schema.type[idx], schema);
						if (typeof result === 'boolean') {
							if (result)
								return true;
							break;
						}
					}
					finally {
						this.docPath.pop();
					}
				}
			}
			finally {
				this.docPath.pop();
			}
		}
		if (schema.properties) {
			this.docPath.push('properties');
			try {
				for (const propName in schema.properties) {
					this.docPath.push(propName);
					try {
						const result = this.inspectSchemaProperty(schema.properties[propName] as SCHEMA, schema);
						if (typeof result === 'boolean') {
							if (result)
								return true;
							break;
						}
					}
					finally {
						this.docPath.pop();
					}
				}
			}
			finally {
				this.docPath.pop();
			}
		}
		if (schema.additionalProperties) {
			this.docPath.push('additionalProperties');
			try {
				if (this.inspectAdditionalProperties(schema.additionalProperties as SCHEMA, schema))
					return true;
			}
			finally {
				this.docPath.pop();
			}
		}
		if ((schema as OpenAPIV3.ArraySchemaObject).items) {
			this.docPath.push('items');
			try {
				if (this.inspectSchemaItems((schema as OpenAPIV3.ArraySchemaObject).items as SCHEMA, schema))
					return true;
			}
			finally {
				this.docPath.pop();
			}
		}
		const allOf = this.inspectMultiType(schema.allOf as (SCHEMA | REFERENCE)[], 'allOf', schema);
		const oneOf = this.inspectMultiType(schema.oneOf as (SCHEMA | REFERENCE)[], 'oneOf', schema);
		const anyOf = this.inspectMultiType(schema.anyOf as (SCHEMA | REFERENCE)[], 'anyOf', schema);
		let notS: SCHEMA | REFERENCE | void | undefined = undefined;
		if (schema.not) {
			this.docPath.push('not');
			try {
				notS = this.inspectSchema(schema.not as SCHEMA | REFERENCE, schema)?.schema;
			}
			finally {
				this.docPath.pop();
			}
		}
		if (Array.isArray(allOf) || Array.isArray(oneOf) || Array.isArray(anyOf) || notS) {
			this.processSchemaJoins(
				schema,
				Array.isArray(allOf) ? allOf : undefined,
				Array.isArray(oneOf) ? oneOf : undefined,
				Array.isArray(anyOf) ? anyOf : undefined,
				notS as SCHEMA | REFERENCE | undefined
			);
		}
	}

	inspectSchemaItems(items: SCHEMA | REFERENCE, parent: SCHEMA) {
		return this.resolve(items, (i) => this.visitSchemaItems(i, parent));
	}

	visitSchemaItems(schema: SCHEMA, parent: SCHEMA): boolean | void {
		// No need to re-inspect as inspection occurred to get here.
		return this.visitSchema(schema, parent);
	}

	protected inspectMultiType(schemas: (SCHEMA | REFERENCE)[], propName: string, parent?: SCHEMA): ((SCHEMA | REFERENCE)[]) | boolean | void | undefined {
		let retVal: (SCHEMA | REFERENCE)[] | undefined;
		if (Array.isArray(schemas)) {
			retVal = [];
			this.docPath.push(propName);
			try {
				for (let idx = 0; idx < schemas.length; idx++) {
					this.docPath.push(String(idx));
					try {
						const result = this.inspectSchema(schemas[idx] as SCHEMA, parent);
						if (result.schema)
							retVal.push(result.schema);
						else
							retVal.push(schemas[idx] as REFERENCE);
						if (typeof result.result === 'boolean') {
							if (result.result)
								return true;
							break;
						}
					}
					finally {
						this.docPath.pop();
					}
				}
			}
			finally {
				this.docPath.pop();
			}
		}
		return retVal;
	}

	inspectAdditionalProperties(schema: SCHEMA | REFERENCE | boolean, parent: SCHEMA): boolean | void {
		return this.resolve(schema as SCHEMA | REFERENCE, (s: SCHEMA | boolean) => {
			if (s === false || (s && typeof s === 'object'))
				return this.visitAdditionalProperties(s, parent);
		});
	}

	visitAdditionalProperties(schema: SCHEMA | boolean, parent: SCHEMA): boolean | void {
		if (typeof schema === 'object') {
			// No need to re-inspect as inspection occurred to get here.
			return this.visitSchema(schema, parent);
		}
	}

	inspectSchemaProperty(schema: SCHEMA | REFERENCE, parent: SCHEMA): boolean | void {
		return this.resolve(schema, (s) => this.visitSchemaProperty(s, parent));
	}

	visitSchemaProperty(schema: SCHEMA, parent: SCHEMA): boolean | void {
		// No need to re-inspect as inspection occurred to get here.
		return this.visitSchema(schema, parent);
	}

	// noinspection JSUnusedLocalSymbols
	visitSchemaType(type: 'boolean' | 'number' | 'string' | 'object' | 'array' | 'integer' | 'null', parent: SCHEMA): boolean | void {
	}

	visitEncoding(encoding: ENCODING, schema?: SCHEMA): boolean | void {
		if (encoding.headers) {
			this.docPath.push('headers');
			try {
				for (const header in encoding.headers) {
					this.docPath.push(header);
					try {
						const result = this.inspectEncodingHeader(encoding.headers[header] as HEADER, schema);
						if (typeof result === 'boolean') {
							if (result)
								return true;
							break;
						}
					}
					finally {
						this.docPath.pop();
					}
				}
			}
			finally {
				this.docPath.pop();
			}
		}
	}

	inspectEncodingHeader(header: HEADER | REFERENCE, schema?: SCHEMA): boolean | void {
		return this.resolve(header, (h) => this.visitEncodingHeader(h, schema));
	}

	/**
	 * Subclass extension point.
	 * A header is mostly a header, so this just turns around and calls visitHeader.
	 */
	visitEncodingHeader(header: HEADER, schema?: SCHEMA) {
		return this.visitHeader(header);
	}

	/**
	 * These have all be visited, this is just a hook to perform union/intersection/negation operations.
	 */
	processSchemaJoins(parent: SCHEMA, allOf?: (SCHEMA | REFERENCE)[], oneOf?: (SCHEMA | REFERENCE)[], anyOf?: (SCHEMA | REFERENCE)[], notSchema?: SCHEMA | REFERENCE) {
	}
}

export class OpenAPIVisitor extends DocumentVisitor<
	OpenAPIV3.Document | OpenAPIV3_1.Document,
	OpenAPIV3.PathsObject | OpenAPIV3_1.PathsObject,
	OpenAPIV3.PathItemObject | OpenAPIV3_1.PathItemObject,
	OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject,
	OpenAPIV3.ParameterObject | OpenAPIV3_1.ParameterObject,
	OpenAPIV3.RequestBodyObject | OpenAPIV3_1.RequestBodyObject,
	OpenAPIV3.MediaTypeObject | OpenAPIV3_1.MediaTypeObject,
	OpenAPIV3.EncodingObject | OpenAPIV3_1.EncodingObject,
	OpenAPIV3.ResponseObject | OpenAPIV3_1.ResponseObject,
	OpenAPIV3.HeaderObject | OpenAPIV3_1.HeaderObject,
	OpenAPIV3.ComponentsObject | OpenAPIV3_1.ComponentsObject,
	OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject,
	OpenAPIV3.SecuritySchemeObject | OpenAPIV3_1.SecuritySchemeObject,
	OpenAPIV3.TagObject | OpenAPIV3_1.TagObject,
	OpenAPIV3.ReferenceObject | OpenAPIV3_1.ReferenceObject,
	OpenAPIV3.Document | OpenAPIV3_1.Document
> {
}

export class OpenAPIV3Visitor<TARGET extends (OpenAPIV3.Document | OpenAPIV3_1.Document) = OpenAPIV3.Document> extends DocumentVisitor<
	OpenAPIV3.Document,
	OpenAPIV3.PathsObject,
	OpenAPIV3.PathItemObject,
	OpenAPIV3.OperationObject,
	OpenAPIV3.ParameterObject,
	OpenAPIV3.RequestBodyObject,
	OpenAPIV3.MediaTypeObject,
	OpenAPIV3.EncodingObject,
	OpenAPIV3.ResponseObject,
	OpenAPIV3.HeaderObject,
	OpenAPIV3.ComponentsObject,
	OpenAPIV3.SchemaObject,
	OpenAPIV3.SecuritySchemeObject,
	OpenAPIV3.TagObject,
	OpenAPIV3.ReferenceObject,
	TARGET
> {
}

// noinspection TypeScriptRedundantGenericType
export class OpenAPIV3_1Visitor extends DocumentVisitor<
	OpenAPIV3_1.Document,
	OpenAPIV3_1.PathsObject,
	OpenAPIV3_1.PathItemObject,
	OpenAPIV3_1.OperationObject,
	OpenAPIV3_1.ParameterObject,
	OpenAPIV3_1.RequestBodyObject,
	OpenAPIV3_1.MediaTypeObject,
	OpenAPIV3_1.EncodingObject,
	OpenAPIV3_1.ResponseObject,
	OpenAPIV3_1.HeaderObject,
	OpenAPIV3_1.ComponentsObject,
	OpenAPIV3_1.SchemaObject,
	OpenAPIV3_1.SecuritySchemeObject,
	OpenAPIV3_1.TagObject,
	OpenAPIV3_1.ReferenceObject,
	OpenAPIV3_1.Document
> {
}
