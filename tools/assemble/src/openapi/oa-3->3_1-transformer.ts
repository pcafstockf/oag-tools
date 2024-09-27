import SwaggerParser from '@apidevtools/swagger-parser';
import {fromSchema} from '@openapi-contrib/openapi-schema-to-json-schema';
import {OpenAPIV3Visitor} from 'oag-shared/openapi/document-visitor';
import {OpenAPIV3, OpenAPIV3_1} from 'openapi-types';

export class Transform3to3_1 extends OpenAPIV3Visitor<OpenAPIV3_1.Document> {
	constructor() {
		super();
	}
	private convertedSchema: Set<OpenAPIV3.SchemaObject>;

	/**
	 * The document passed in *must* be valid, and the converted document is guaranteed to be valid as well.
	 */
	async convert(doc: OpenAPIV3.Document): Promise<OpenAPIV3_1.Document | boolean> {
		const parser = new SwaggerParser();
		const refs = await parser.resolve(doc);
		const seen = new Set();
		this.convertedSchema = new Set<OpenAPIV3.SchemaObject>();
		const result = this.visit(doc, (ref: OpenAPIV3.ReferenceObject) => {
			const obj = refs.get(ref.$ref);
			if (obj) {
				if (seen.has(obj))
					return;
				seen.add(obj);
			}
			return obj;
		}, true);
		seen.clear();
		this.convertedSchema.clear();
		doc.openapi = '3.1.0';
		// Better still be valid.
		await parser.validate(structuredClone(doc));
		return result;
	}

	visitSchema(schema: OpenAPIV3.SchemaObject, parent?: OpenAPIV3.SchemaObject): boolean | void {
		const activePath = this.activeJsonPath;
		const result = super.visitSchema(schema, parent);
		if (! this.convertedSchema.has(schema)) {
			// Since we are recursing, we do not want openapi-schema-to-json-schema doing recursive conversion too.
			// So pull out any children, convert, and then put the children back.
			const schemaSpecificProps = ['properties', 'additionalProperties', 'items', 'allOf', 'oneOf', 'anyOf', 'not'];
			const propContainer = schemaSpecificProps.reduce((p, key) => {
				if ((schema as any)[key]) {
					p[key] = (schema as any)[key];
					delete (schema as any)[key];
				}
				return p;
			}, {} as any);
			fromSchema(schema, {
				cloneSchema: false
			});
			Object.assign(schema, propContainer);
			this.convertedSchema.add(schema);
			if (!/^#\/components\/schemas\/([a-z_$][a-z_$0-9]*)$/i.test(activePath))
				delete (schema as any)['$schema'];
		}
		return result;
	}
}
