/**
 * Removes all example and examples properties from an OpenAPI document.
 * This can be useful for reducing document size or removing potentially sensitive example data.
 * Removes both singular 'example' and plural 'examples' properties from all schema objects,
 * parameters, media types, headers, and any other locations where they may appear.
 */
import {OpenAPIV3, OpenAPIV3_1} from 'openapi-types';

// noinspection JSUnusedGlobalSymbols
export default async function removeExamples(doc: OpenAPIV3.Document | OpenAPIV3_1.Document, _cmdArgs: Record<string, any>): Promise<void> {
	function processObject(obj: any): void {
		if (typeof obj !== 'object' || obj === null)
			return;
		if (Array.isArray(obj)) {
			obj.forEach(processObject);
			return;
		}
		// Remove 'example' property if it exists
		if (obj.hasOwnProperty('example')) {
			delete obj.example;
		}
		// Remove 'examples' property if it exists
		if (obj.hasOwnProperty('examples')) {
			delete obj.examples;
		}
		// Recursively process all properties
		Object.values(obj).forEach(processObject);
	}

	processObject(doc);

	return Promise.resolve();
}
