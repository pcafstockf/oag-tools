import {parse as json5Parse} from 'json5';
import lodash from 'lodash';
import {lstatSync, mkdirSync, readFileSync, Stats} from 'node:fs';
import * as os from 'node:os';
import path from 'node:path';
import {safeLStatSync} from 'oag-shared/utils/misc-utils';
import unquotedValidator from 'unquoted-property-validator';

export interface CLIOptionsBase<CONFIG, IN, OUT, VERBOSE, MERGE, PROP, FIX, BUNDLE, TRANSFORM, UPGRADE> {
	/**
	 * JSON file containing commands and config overrides
	 */
	c: CONFIG,
	/**
	 * OpenAPI input document (file or url)
	 * This must be a syntactically valid swagger/openapi document.
	 */
	i: IN,
	/**
	 * Filepath for the final openapi v3.1 json document.
	 */
	o: OUT,
	/**
	 * Provide progress and diagnostic output
	 */
	v: VERBOSE
	/**
	 * Merge additional (syntactically valid) yaml/json files into the input file.
	 * Each file will attempt to be loaded as a swagger/openapi document and bundled.
	 * If loaded as a swagger (v2) document, it will be upgraded to v3 *before* merging continues.
	 * If loading as swagger/openapi fails, it will be attempted as a json5 file.
	 * The resulting object will then be merged into the input document and then continue to the next merger.
	 */
	m: MERGE,
	/**
	 * Key/Value of a property to be specified or overridden
	 */
	p: PROP,
	/**
	 * One or more standalone JavaScript plugins to apply fixes *after* merge.
	 */
	f: FIX,
	/**
	 * Bundles all external files/URL refs into a single validated document containing only internal $refs.
	 */
	b: BUNDLE,
	/**
	 * One or more standalone JavaScript plugins to perform transformations on a validated and bundled 3.x document.
	 * NOTE: If the bundle flag is not set, these plugins will not be invoked (they assume they are passed a valid bundled document)
	 */
	t: TRANSFORM,
	/**
	 * Documents are immediately upgraded to 3.x upon input (even before merge).
	 * This flag upgrades the validated bundle to v3.1 JSON Schema
	 * NOTE: If the bundle flag is not set, this operation will not be performed.
	 */
	u: UPGRADE
}

// Make them all optional, then CLIOptionsType will add back the two we absolutely require.
type PartialCLIOptionsType = Partial<CLIOptionsBase<
	string /*config*/,
	string /*in*/,
	string /*out*/,
	boolean /*verbose*/,
	string[] /*merge*/,
	string[] /*prop*/,
	string[] /*fix*/,
	boolean /*bundle*/,
	string[] /*transform*/,
	boolean /*upgrade*/
>>;

/**
 * The actual (language neutral) interface of all the cli options for the generator.
 */
export type CLIOptionsType = PartialCLIOptionsType & Required<Pick<PartialCLIOptionsType, 'i' | 'o'>>;

function resolveConfiguration(args: CLIOptionsType): CLIOptionsType {
	if (args.c) {
		const stat = safeLStatSync(args.c);
		if (!stat?.isFile())
			throw new Error('Invalid config override file: ' + args.c);
		const configTxt = readFileSync(args.c, 'utf8');
		const config = json5Parse(configTxt);
		return lodash.merge(config ?? {}, args) as CLIOptionsType;
	}
	return args;
}

function validateInputLocation(loc: string) {
	let stat: Stats = undefined as any;
	if (!loc)
		throw new Error('Input file must be specified');
	try {
		let url = new URL(loc);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			// noinspection ExceptionCaughtLocallyJS
			throw new Error('NOT-URL');
		}
	}
	catch (err) {
		stat = lstatSync(loc);
	}
	if (stat && !stat?.isFile())
		throw new Error('Input must be a specification file: ' + loc);
}

/**
 * This function may be called twice.
 * @param args  These will be the args passed to the process.
 * @param update
 *  If false, the *existing* options should be checked for validity, but nothing should be modified.
 *  If true, needed modifications to the options should be applied and updated options should be returned.
 */
export function checkCliArgs(args: CLIOptionsType, update: boolean): boolean | CLIOptionsType {
	let config = resolveConfiguration(args);

	validateInputLocation(config.i);
	if (typeof config.m === 'string' && config.m)
		config.m = [config.m];
	if (Array.isArray(config.m))
		config.m.forEach(validateInputLocation);

	if (!config.o)
		throw new Error('Output file must be provided');
	const o = config.o.startsWith('~') ? path.resolve(path.join(os.homedir(), config.o.slice(1))) : path.resolve(config.o);
	if (!safeLStatSync(path.dirname(o)) && update)
		mkdirSync(path.dirname(o), {recursive: true});
	config.o = o;
	// pre-upgrade plugins
	let plugins = config.f;
	if (plugins && typeof plugins === 'string')
		plugins = [plugins];
	if (Array.isArray(plugins))
		plugins.map(t => path.resolve(process.cwd(), t)).forEach(t => lstatSync(t));
	// post-upgrade plugins.
	plugins = config.t;
	if (plugins && typeof plugins === 'string')
		plugins = [plugins];
	if (Array.isArray(plugins))
		plugins.map(t => path.resolve(process.cwd(), t)).forEach(t => lstatSync(t));

	let props = config.p;
	if (props && typeof props === 'string')
		props = [props];
	if (props && Array.isArray(props)) {
		if (update)
			config.p = props;
		props.forEach((v) => {
			let kvp = v.trim().split('=');
			if (kvp.length !== 2 || (!kvp[0].trim() || (!kvp[1].trim())))
				throw new Error('Invalid property definition: ' + v);
			const valid = kvp[0].trim().split('.').every((v) => {
				const m = /^(.*)(\[\d+])?$/.exec(v);
				if (m) {
					if (m[1]) {
						let result = unquotedValidator(m[1]);
						if ((!result) || result.needsBrackets || result.needsQuotes)
							return false;
					}
					return true;
				}
				return false;
			});
			if (!valid)
				throw new Error('Invalid property key: ' + v);
		});
	}
	return (update ? config : true);
}

export type ArgsChecker = typeof checkCliArgs;
