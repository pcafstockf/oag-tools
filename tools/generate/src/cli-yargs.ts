import process from 'node:process';
import yargs, {Options} from 'yargs';
import {ArgsChecker, CLIOptionsBase, CLIOptionsType} from './cli-opts';

/**
 * Defined as a yargs compatible structure, this constant should be parsable by other (non-node) environments to their own native argument parsing library.
 */
export const YargsCliOptions = <CLIOptionsBase<Options, Options, Options, Options, Options, Options, Options, Options>>{
	c: {alias: 'config', normalize: true, type: 'string', nargs: 1, identifier: 'JSON file containing commands and config overrides'},
	i: {alias: 'in', normalize: true, type: 'string', nargs: 1, identifier: 'OpenAPI input specification'},
	o: {alias: 'out', normalize: true, type: 'string', nargs: 1, identifier: 'Directory for output of generated code.'},
	v: {alias: 'verbose', type: 'boolean', string: false, number: false, identifier: 'If set, verbose progresses and diagnostic info will be output'},
	p: {alias: 'prop', type: 'array', nargs: 1, string: true, number: false, identifier: 'Key/Value of a property to be specified or overridden'},
	r: {alias: 'role', type: 'string', string: true, number: false, choices: ['client', 'server'], identifier: 'Generated code is calling, or providing an API'},
	d: {alias: 'delete', type: 'string', string: true, number: false, choices: ['all', 'gen'], identifier: 'Delete all files (support, server impl, etc.) or only model/api'},
	s: {alias: 'settings', normalize: true, type: 'array', nargs: 1, string: true, number: false, identifier: 'One or more json5 files containing code generator settings.'},
};

export function parseCliArgs(baseArgs: string[], validator: ArgsChecker): Promise<CLIOptionsType> {
	// yargs can return an object, *OR* a Promise for an object.
	// So, wrapping it in a Promise.resolve, ensures we get good typing and easy support for async init and run.
	return Promise.resolve<CLIOptionsType>(yargs(baseArgs)
		.usage('Usage: $0 <command> [options]')
		.options(YargsCliOptions as unknown as { [key: string]: Options })
		.coerce('d', (arg: string | boolean) => {

			if (arg === 'true' || arg === true)
				return 'gen';
			else if (arg === 'false' || arg === false)
				return undefined;
			return arg;
		})
		.help('h')
		.alias('h', 'help')
		.version(process.env.OAG_VERSION ?? 'un-released') // Don't stress, our release will be webpacked and this will become a constant at that time.
		.wrap(yargs.terminalWidth())
		.check(args => validator(args as unknown as CLIOptionsType, false))
		.argv as any).then((args) => validator(args as CLIOptionsType, true) as CLIOptionsType);
}
