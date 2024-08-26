import process from 'node:process';
import yargs, {Options} from 'yargs';
import {ArgsChecker, CLIOptionsBase, CLIOptionsType} from './cli-opts';

/**
 * Defined as a yargs compatible structure, this constant should be parsable by other (non-node) environments to their own native argument parsing library.
 */
export const YargsCliOptions = <CLIOptionsBase<Options, Options, Options, Options, Options, Options, Options, Options, Options, Options>>{
	c: {alias: 'config', normalize: true, type: 'string', nargs: 1, identifier: 'JSON file containing commands and config overrides'},
	i: {alias: 'in', normalize: true, type: 'string', nargs: 1, identifier: 'OpenAPI input specification'},
	o: {alias: 'out', normalize: true, type: 'string', nargs: 1, identifier: 'Optimized/Bundled output specification'},
	v: {alias: 'verbose', type: 'boolean', string: false, number: false, identifier: 'If set, verbose progresses and diagnostic info will be output'},
	m: {alias: 'merge', normalize: true, type: 'array', nargs: 1, string: true, number: false, identifier: 'Merge additional (syntactically valid) yaml/json files into the input file.'},
	p: {alias: 'prop', type: 'array', nargs: 1, string: true, number: false, identifier: 'Key/Value of a property to be specified or overridden'},
	f: {alias: 'fix', normalize: true, type: 'array', nargs: 1, string: true, number: false, identifier: 'JavaScript plugin for fixing merged document (pre-validation).'},
	b: {alias: 'bundle', type: 'boolean', string: false, number: false, identifier: 'Bundles all external files/URL refs into a single validated document containing only refs.'},
	t: {alias: 'transform', normalize: true, type: 'array', nargs: 1, string: true, number: false, identifier: 'JavaScript plugin for specification transformation (post-validation).'},
	u: {alias: 'upgrade', type: 'boolean', string: false, number: false, identifier: 'Documents are upgraded to 3.x upon input/merge.  This flag upgrades the validated bundle to v3.1 JSON Schema'},
};

export function parseCliArgs(baseArgs: string[], validator: ArgsChecker): Promise<CLIOptionsType> {
	// yargs can return an object, *OR* a Promise for an object.
	// So, wrapping it in a Promise.resolve, ensures we get good typing and easy support for async init and run.
	return Promise.resolve<CLIOptionsType>(yargs(baseArgs)
		.usage('Usage: $0 <command> [options]')
		.options(YargsCliOptions as unknown as { [key: string]: Options })
		.help('h')
		.alias('h', 'help')
		.version(process.env.OAG_VERSION ?? 'un-released') // Don't stress, our release will be webpacked and this will become a constant at that time.
		.wrap(yargs.terminalWidth())
		.check(args => validator(args as unknown as CLIOptionsType, false))
		.argv as any).then((args) => validator(args as CLIOptionsType, true) as CLIOptionsType);
}
