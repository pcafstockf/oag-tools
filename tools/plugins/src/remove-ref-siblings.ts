/**
 * Removes description properties that are siblings to $ref.
 * In OpenAPI 3.x, $ref cannot have sibling properties as the $ref completely replaces the object.
 * This plugin scans the document for such occurrences and removes the invalid description siblings.
 */
import {OpenAPIV3, OpenAPIV3_1} from 'openapi-types';

// noinspection JSUnusedGlobalSymbols
export default async function removeRefSiblingDescriptions(doc: OpenAPIV3.Document | OpenAPIV3_1.Document, _cmdArgs: Record<string, any>): Promise<void> {
	function processObject(obj: any): void {
		if (typeof obj !== 'object' || obj === null)
			return;
		if (Array.isArray(obj)) {
			obj.forEach(processObject);
			return;
		}
		// Check if this object has both $ref and description
		if (obj.$ref && obj.description)
			delete obj.description;
		// Recursively process all properties
		Object.values(obj).forEach(processObject);
	}

	processObject(doc);

	return Promise.resolve();
}
