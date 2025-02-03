/**
 * It is common (but incorrect) for openapi documents to define the names of query parameters as:
 *  'obj[prop]'
 * This plugin scans the document for such occurrences and consolidates them into a single 'deepObject' serialized query schema.
 */
import SwaggerParser from '@apidevtools/swagger-parser';
import {OpenAPIV3, OpenAPIV3_1} from 'openapi-types';

const HttpVerbs = Object.keys(OpenAPIV3.HttpMethods) as string[];

// noinspection JSUnusedGlobalSymbols
export default async function consolidateQueryParams(doc: OpenAPIV3.Document | OpenAPIV3_1.Document, _cmdArgs: Record<string, any>): Promise<void> {
	const docParser = new SwaggerParser();
	const refs = await docParser.resolve(doc);
	for (let upath in doc.paths) {
		let pathItem = doc.paths[upath] as OpenAPIV3.PathItemObject | OpenAPIV3.ReferenceObject;
		if ('$ref' in pathItem && pathItem.$ref)
			pathItem = refs.get(pathItem.$ref);
		for (let method in Object.keys(doc.paths[upath]!).filter(k => HttpVerbs.includes(k.toUpperCase()))) {
			const operation = doc.paths[upath]![method] as OpenAPIV3.OperationObject;
			if (operation.parameters) {
				const queryRequired: Record<string, boolean> = {};
				const params = operation.parameters.reduce((p, v) => {
					if ('$ref' in v)
						v = refs.get(v.$ref as string);
					p.push(v as OpenAPIV3.ParameterObject);
					return p;
				}, [] as OpenAPIV3.ParameterObject[]);
				// Find all obj[prop] style parameters
				const paramGroups = params.reverse().reduce((acc, param, idx, arr) => {
					if (param.in === 'query') {
						const match = param.name.match(/^(\w+)\[(\w+)]$/);
						if (match) {
							const [, base, prop] = match;
							if (!acc[base]) {
								acc[base] = {};
							}
							queryRequired[base] = (queryRequired[base] || param.required) ?? false;
							acc[base][prop] = {
								...param,
								name: prop  // Change name to property name
							};
							// This is a nested param, so we want to remove it from the operations.
							// We are operating on a reverse of operation.parameters, so we can effectively remove back to front.
							// But keep in mind, that it is shrinking based on this spliceing, so we need to reference the original length.
							operation.parameters!.splice(arr.length - 1 - idx, 1);
						}
					}
					return acc;
				}, {});
				// Add consolidated parameters
				for (const [base, props] of Object.entries(paramGroups)) {
					const schemaName = base + 'Query';
					const schemaObj = {
						type: 'object' as any,
						required: queryRequired[base] ? [] as string[] : undefined,
						properties: {}
					};
					for (const [prop, param] of Object.entries(props!)) {
						if (param.required) {
							if (!schemaObj.required)
								schemaObj.required = [] as string[];
							schemaObj.required.push(prop);
						}
						schemaObj.properties[prop] = {
							type: param.schema.type,
							description: param.description
						};
					}
					if (!doc.components)
						doc.components = {schemas: {}};
					else if (!doc.components.schemas)
						doc.components.schemas = {};
					doc.components.schemas![schemaName] = schemaObj;
					operation.parameters.push({
						in: 'query',
						name: base,
						style: 'deepObject',
						explode: true,
						schema: {$ref: '#/components/schemas/' + schemaName}
					});
				}
			}
		}
	}
	return Promise.resolve();
}
