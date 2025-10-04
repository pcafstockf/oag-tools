import 'reflect-metadata';
import SwaggerParser from '@apidevtools/swagger-parser';
import {Container} from 'async-injection';
import {InitializeMarker, keyValueToConfig, loadConfigFile, makeConfig} from 'dyflex-config';
import path from 'node:path';
import {BaseSettings, cleanOutDir} from 'oag-shared/lang-neutral/settings';
import {OpenAPIV3_1} from 'openapi-types';
import {checkCliArgs} from './cli-opts';
import {parseCliArgs} from './cli-yargs';
import {SourceGeneratorToken} from './generators/source-generator';
import {setupTsMorphClient} from './generators/tsmorph/client/setup';
import {setupTsMorphServer} from './generators/tsmorph/server/setup';
import {LangNeutralGenerator} from './lang-neutral-generator';
import {ClientSettings, ClientSettingsType} from './settings/client';
import {ServerSettings, ServerSettingsType} from './settings/server';
import {TsMorphSettings, TsMorphSettingsType} from './settings/tsmorph';
import {TsMorphClientSettings} from './settings/tsmorph-client';
import {TsMorphServerSettings} from './settings/tsmorph-server';

(async () => {
	const cliArgs = await parseCliArgs(process.argv.slice(2), checkCliArgs);
	const container = new Container();
	const settings = {
		base: BaseSettings,
		server: undefined as ServerSettingsType,
		client: undefined as ClientSettingsType,
		// Maybe someday we will be dynamic about this.
		tsmorph: TsMorphSettings as TsMorphSettingsType & { client?: typeof TsMorphClientSettings } & { server?: typeof TsMorphServerSettings }
	};
	if (cliArgs.r === 'server') {
		settings.base.role = 'server';
		settings.server = ServerSettings;
		settings.tsmorph.server = TsMorphServerSettings;
		settings.tsmorph.server[InitializeMarker].fn = setupTsMorphServer;
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
			evalCb: (key: symbol, obj: object, _path: string[]) => {
				container.bindConstant(key, obj);
			},
			ctx: container
		},
		...settingsOverrides,
	);
	const lg = await container.resolve(SourceGeneratorToken);

	const lng = new LangNeutralGenerator(container);
	const parser = new SwaggerParser();
	const doc = await parser.bundle(cliArgs.i) as OpenAPIV3_1.Document;
	const lang = await lng.generate(doc, !config.base.allModels);
	await cleanOutDir(cliArgs.d, cliArgs.o, config.base);
	await lg.generate(lang);
})().catch(err => {
	console.error(err);
});
