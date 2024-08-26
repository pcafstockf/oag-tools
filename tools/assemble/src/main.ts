import {mkdirSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {safeLStatSync} from 'oag-shared/utils/misc-utils';
import {OpenAPIV3, OpenAPIV3_1} from 'openapi-types';
import {checkCliArgs} from './cli-opts';
import {parseCliArgs} from './cli-yargs';
import {OpenApiInputProcessor} from './openapi/document-processor';

(async () => {
	const cliArgs = await parseCliArgs(process.argv.slice(2), checkCliArgs);

	// Build and optimize the input document.
	const docProcessor = new OpenApiInputProcessor();
	let doc = await docProcessor.merge(
		cliArgs.m && cliArgs.m?.length > 0 ? [cliArgs.i].concat(...cliArgs.m) : cliArgs.i,
		true,
		(cliArgs.p ?? []).reduce((p, v) => {
			let idx = v.indexOf('=');
			if (idx > 0) {
				p[v.substring(1, idx).trim()] = v.substring(idx + 1);
			}
			return p;
		}, {} as Record<string, string>)
	);

	// Allow any "fixer" plugins to do repair work before we start our own work on the document.
	let plugins = cliArgs.f;
	if (plugins && typeof plugins === 'string')
		plugins = [plugins];
	if (Array.isArray(plugins)) {
		for (let fp of plugins) {
			const txFn = require(path.resolve(process.cwd(), fp)).default;
			const result: OpenAPIV3.Document | OpenAPIV3_1.Document = await txFn(doc, cliArgs);
			if (result)
				doc = result;
		}
	}

	if (cliArgs.b) {
		doc = await docProcessor.bundleAndValidateDocument(doc);

		// Allow any custom transformation plugins before we generate code
		plugins = cliArgs.t;
		if (plugins && typeof plugins === 'string')
			plugins = [plugins];
		if (Array.isArray(plugins)) {
			for (let fp of plugins) {
				const txFn = require(path.resolve(process.cwd(), fp)).default;
				const result: OpenAPIV3_1.Document = await txFn(doc, cliArgs);
				if (result)
					doc = result;
			}
		}

		// Code generation requires a valid 3.1 document.
		if (cliArgs.u)
			doc = await docProcessor.ensure31Document(doc);
	}

	// Write the bundle.
	if (!safeLStatSync(path.dirname(cliArgs.o)))
		mkdirSync(path.dirname(cliArgs.o), {recursive: true});
	await writeFile(cliArgs.o, JSON.stringify(doc), 'utf8');
})().catch(err => {
	console.error(err);
});
