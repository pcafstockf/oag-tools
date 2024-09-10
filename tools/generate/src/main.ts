import 'reflect-metadata';
import SwaggerParser from '@apidevtools/swagger-parser';
import {Container} from 'async-injection';
import {InitializeMarker, keyValueToConfig, loadConfigFile, makeConfig} from 'dyflex-config';
import {rmSync as rimrafSync} from 'fs';
import path from 'node:path';
import {OpenAPIV3_1} from 'openapi-types';
import {checkCliArgs} from './cli-opts';
import {parseCliArgs} from './cli-yargs';
import {setupTsMorphClient} from './generators/tsmorph/client/setup';
import {LangNeutralGenerator} from './lang-neutral-generator';
import {BaseSettings} from 'oag-shared/lang-neutral/base-settings';
import {ClientSettings, ClientSettingsType} from './settings/client';
import {ServerSettings, ServerSettingsType} from './settings/server';
import {TsMorphSettings, TsMorphSettingsType} from './settings/tsmorph';
import {TsMorphClientSettings} from './settings/tsmorph-client';
import {TsMorphServerSettings, TsMorphServerSettingsType} from './settings/tsmorph-server';

(async () => {
	const cliArgs = await parseCliArgs(process.argv.slice(2), checkCliArgs);
	const container = new Container();
	const settings = {
		base: BaseSettings,
		server: undefined as ServerSettingsType,
		client: undefined as ClientSettingsType,
		// Maybe someday we will be dynamic about this.
		tsmorph: TsMorphSettings as TsMorphSettingsType & { client?: typeof TsMorphClientSettings } & { server?: TsMorphServerSettingsType }
	};
	if (cliArgs.r === 'server') {
		settings.base.role = 'server';
		settings.server = ServerSettings;
		settings.tsmorph.server = TsMorphServerSettings;
	}
	else {
		settings.base.role = 'client';
		settings.client = ClientSettings;
		settings.tsmorph.client = TsMorphClientSettings;
		settings.tsmorph.client[InitializeMarker].fn = setupTsMorphClient;
	}
	let settingsFiles = cliArgs.s;
	if (settingsFiles && typeof settingsFiles === 'string')
		settingsFiles = [settingsFiles];
	const settingsOverrides = [];
	if (Array.isArray(settingsFiles)) {
		for (let fp of settingsFiles)
			settingsOverrides.push(await loadConfigFile(fp));
	}
	if (cliArgs.p)
		settingsOverrides.push(keyValueToConfig(cliArgs.p));
	// Ensure we get the last word...
	settingsOverrides.push({
		base: {
			role: cliArgs.r === 'server' ? 'server' : 'client',
			outputDirectory: path.resolve(cliArgs.o)
		}
	});
	const config = await makeConfig(settings, {
			evalCb: (key: symbol, obj: object, path: string[]) => {
				container.bindConstant(key, obj);
			},
			ctx: container
		},
		...settingsOverrides,
	);

	// Clean up anything previously generated (if requested to do so).
	if (cliArgs.d) {
		if (cliArgs.d === 'all')
			rimrafSync(cliArgs.o, {recursive: true, force: true});   // This may make all the follow statements irrelevant, but not necessarily.
		if (config.base.modelIntfDir)
			rimrafSync(path.join(cliArgs.o, config.base.modelIntfDir), {recursive: true, force: true});
		if (config.base.modelImplDir)
			rimrafSync(path.join(cliArgs.o, config.base.modelImplDir), {recursive: true, force: true});
		if (config.base.modelPrivDir)
			rimrafSync(path.join(cliArgs.o, config.base.modelPrivDir), {recursive: true, force: true});
		if (config.base.apiIntfDir)
			rimrafSync(path.join(cliArgs.o, config.base.apiIntfDir), {recursive: true, force: true});
		if (config.base.role !== 'server' && config.base.apiImplDir)
			rimrafSync(path.join(cliArgs.o, config.base.apiImplDir), {recursive: true, force: true});
		if (config.base.apiPrivDir)
			rimrafSync(path.join(cliArgs.o, config.base.apiPrivDir), {recursive: true, force: true});
		if (config.base.apiHndlDir)
			rimrafSync(path.join(cliArgs.o, config.base.apiHndlDir), {recursive: true, force: true});
	}

	const generator = new LangNeutralGenerator(container);
	const parser = new SwaggerParser();
	const doc = await parser.bundle(cliArgs.i) as OpenAPIV3_1.Document;
	const lang = await generator.generate(doc, !config.base.allModels);

	// lang.models.forEach(m => {
	// 	console.log(m.toString());
	// });
	lang.apis.forEach(m => {
		console.log(m.toString());
	});

})().catch(err => {
	console.error(err);
});
