/**
 * Removes all example and examples properties from an OpenAPI document.
 * This can be useful for reducing document size or removing potentially sensitive example data.
 * Removes both singular 'example' and plural 'examples' properties from all schema objects,
 * parameters, media types, headers, and any other locations where they may appear.
 */
import {OpenAPIV3, OpenAPIV3_1} from 'openapi-types';

// noinspection JSUnusedGlobalSymbols
export default async function removeProps(doc: OpenAPIV3.Document | OpenAPIV3_1.Document, cmdArgs: Record<string, any>): Promise<void> {
	cmdArgs = {...cmdArgs};
	if (cmdArgs['remove-prop']) {
		let propName = cmdArgs['remove-prop'];
		if (!Array.isArray(propName))
			cmdArgs['remove-prop'] = [propName];
		else if (cmdArgs['remove-prop'].length == 0)
			cmdArgs['remove-prop'] = ['example', 'examples'];
	}
	else
		cmdArgs['remove-prop'] = ['example', 'examples']
	console.log(`Removing properties: '${cmdArgs['remove-prop'].join("', '")}'`);

	function processObject(obj: any): void {
		if (typeof obj !== 'object' || obj === null)
			return;
		if (Array.isArray(obj)) {
			obj.forEach(processObject);
			return;
		}
		// Remove any relevant properties
		cmdArgs['remove-prop'].forEach(pn => delete obj[pn]);

		// Recursively process all properties
		Object.values(obj).forEach(processObject);
	}

	if (Array.isArray(cmdArgs['remove-prop']))
		processObject(doc);

	return Promise.resolve();
}
