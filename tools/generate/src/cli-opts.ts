import {parse as json5Parse} from 'json5';
import lodash from 'lodash';
import {lstatSync, mkdirSync, readFileSync, Stats} from 'node:fs';
import path from 'node:path';
import unquotedValidator from 'unquoted-property-validator';
import {safeLStatSync} from '../../../oag-shared/src/utils/misc-utils';

export interface CLIOptionsBase<CONFIG, IN, OUT, VERBOSE, PROP, ROLE, DELETE, SETTINGS> {
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
	 * Key/Value of a property to be specified or overridden
	 */
	p: PROP,
	/**
	 * Are we generating code for a server or a client.
	 */
	r: ROLE,
	/**
	 * Should the entire output directory be deleted before generation, or just the various gen directories?
	 */
	d: DELETE
	/**
	 * Is the generated code for a client or a server?
	 */
	s: SETTINGS,
}

// Make them all optional, then CLIOptionsType will add back the two we absolutely require.
type PartialCLIOptionsType = Partial<CLIOptionsBase<
	string /*config*/,
	string /*in*/,
	string /*out*/,
	boolean /*verbose*/,
	string[] /*prop*/,
	string /*role*/,
	boolean | string /*delete*/,
	string[] /*settings*/
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
	let stat: Stats = undefined as any;
	let config = resolveConfiguration(args);

	validateInputLocation(config.i);

	if (!config.o)
		throw new Error('Output directory must be provided');
	stat = safeLStatSync(config.o);
	if (!stat && update) {
		mkdirSync(config.o, {recursive: true});
		stat = lstatSync(config.o);
		delete config.d;   // Don't delete twice if we just created it.
	}
	if (stat && (!stat?.isDirectory())) {
		throw new Error('Invalid output directory: ' + config.o);
	}

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

	let settings = config.s;
	if (settings && typeof settings === 'string')
		settings = [settings];
	if (Array.isArray(settings))
		settings.map(t => path.resolve(process.cwd(), t)).forEach(t => lstatSync(t));

	return (update ? config : true);
}

export type ArgsChecker = typeof checkCliArgs;
