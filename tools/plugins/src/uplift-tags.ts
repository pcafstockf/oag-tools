/**
 * Merges operation-level tags into the top-level tags array.
 * - If a case-insensitive match exists, the operation tag name is normalized to match the top-level casing.
 * - If no match exists, a new top-level tag is created and logged to the console.
 */
import {OpenAPIV3, OpenAPIV3_1} from 'openapi-types';

// noinspection JSUnusedGlobalSymbols
export default async function upliftOperationTags(doc: OpenAPIV3.Document | OpenAPIV3_1.Document, _cmdArgs: Record<string, any>): Promise<void> {
	// Ensure top-level tags array exists
	if (!doc.tags) {
		doc.tags = [];
	}

	// Build a case-insensitive lookup map: lowercase name -> actual tag object
	const tagLookup = new Map<string, OpenAPIV3.TagObject>();
	for (const tag of doc.tags) {
		tagLookup.set(tag.name.toLowerCase(), tag);
	}

	function processOperations(pathItem: OpenAPIV3.PathItemObject | OpenAPIV3_1.PathItemObject): void {
		const httpMethods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

		for (const method of httpMethods) {
			const operation = pathItem[method] as OpenAPIV3.OperationObject | OpenAPIV3_1.OperationObject | undefined;
			if (!operation?.tags) {
				continue;
			}

			for (let i = 0; i < operation.tags.length; i++) {
				const operationTagName = operation.tags[i];
				const lowerName = operationTagName.toLowerCase();
				const existingTag = tagLookup.get(lowerName);

				if (existingTag) {
					// Normalize operation tag to match top-level casing
					operation.tags[i] = existingTag.name;
				}
				else {
					// Create new top-level tag
					const newTag: OpenAPIV3.TagObject = {name: operationTagName};
					doc.tags!.push(newTag);
					tagLookup.set(lowerName, newTag);
					console.log(`Created new top-level tag: "${operationTagName}"`);
				}
			}
		}
	}

	// Walk all paths and their operations
	if (doc.paths) {
		for (const pathItem of Object.values(doc.paths)) {
			if (pathItem) {
				processOperations(pathItem);
			}
		}
	}

	return Promise.resolve();
}
