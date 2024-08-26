/**
 * This plugin walks the document (deeply), to find inline object schema.
 * IF a nested schema has a title or 'x-schema-name', hoist it to global context (#/components/schemas), and modify the parent to reference it.
 * IF a nested schema does *not* have a title or 'x-schema-name', and if
 * the -v (verbose) flag is set, log the JSON Path of the untitled schema.
 */
import SwaggerParser from '@apidevtools/swagger-parser';
import {OpenAPIV3, OpenAPIV3_1} from 'openapi-types';
import {OpenAPIVisitor} from 'oag-shared/openapi/document-visitor';

class UpliftSchema extends OpenAPIVisitor {
	constructor(private refs: SwaggerParser.$Refs, private reportMissing: boolean) {
		super();
	}

	visitSchema(schema: OpenAPIV3.SchemaObject, parent?: OpenAPIV3.SchemaObject): boolean | void {
		let needPop = false;
		const activePath = this.activeJsonPath;
		const isNested = !/^#\/components\/schemas\/([a-z_$][a-z_$0-9]*)$/i.test(activePath);
		const schemaName = schema.title || schema['x-schema-name'];
		if (schemaName) {
			if (isNested) {
				const clonedSchema = Object.keys(schema).reduce((p, key) => {
					p[key] = schema[key];
					delete schema[key];
					return p;
				}, {} as OpenAPIV3.SchemaObject);
				const doc = this.refs.get(`#`) as OpenAPIV3.Document;
				if (!doc.components)
					doc.components = {schemas: {}};
				else if (!doc.components.schemas)
					doc.components.schemas = {};
				(schema as OpenAPIV3.ReferenceObject).$ref = `#/components/schemas/${schemaName}`;
				if (doc.components.schemas![schemaName])
					return;
				delete clonedSchema['x-schema-name'];
				doc.components.schemas![schemaName] = clonedSchema;
				this.refs.set((schema as OpenAPIV3.ReferenceObject).$ref, clonedSchema);
				schema = clonedSchema;
				this.docPath.push(Object.freeze({
					...schema
				}) as OpenAPIV3.ReferenceObject);
				needPop = true;
			}
		}
		else if (this.reportMissing && isNested && schema.type === 'object') {
			console.log(`No schema name for: ${activePath}`)
		}
		try {
			return super.visitSchema(schema, parent);
		}
		finally {
			if (needPop)
				this.docPath.pop();
		}
	}
}

// noinspection JSUnusedGlobalSymbols,JSUnusedLocalSymbols
export default async function upliftSchema(doc: OpenAPIV3.Document | OpenAPIV3_1.Document, cmdArgs: Record<string, any>): Promise<void> {
	const docParser = new SwaggerParser();
	const refs = await docParser.resolve(doc);

	const docVisitor = new UpliftSchema(refs, !!cmdArgs['uplift-report']);
	docVisitor.visit(doc, (ref: OpenAPIV3.ReferenceObject) => {
		return refs.get(ref.$ref);
	}, false);
	return Promise.resolve();
};
