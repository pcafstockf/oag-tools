import {InjectableId} from 'async-injection';
import {RegisterConfigMarker} from 'dyflex-config';
import {rmSync as rimrafSync} from 'fs';
import path from 'node:path';
import {NameCase} from '../utils/name-utils';

export const BaseSettings = {
	[RegisterConfigMarker]: 'CODE_GEN_BASE',

	allModels: true, // If true generate all models in the spec, if false only generate those models referenced by operations in the spec.
	outputDirectory: undefined as string,

	// Fine-grained control over *BOTH* where things are stored *AND* what gets generated!
	modelIntfDir: 'models',  // if truthy, generate model interfaces
	modelImplDir: null as string,  // if truthy, generate model classes
	modelPrivDir: null as string,  // if falsy, modelImplDir will be used when/if needed.
	modelJsonDir: null as string,  // if truthy, json schema (for 3.x specs will be written to this directory).
	apiIntfDir: 'apis',  // if truthy, generate api interfaces
	apiImplDir: 'services',  // if truthy, generate api classes
	apiPrivDir: null as string, // if falsy, apiImplDir will be used when/if needed.
	apiMockDir: null as string,  // if truthy, generate mock api classes; Ignored if the role is not 'client'.
	apiHndlDir: 'handlers', // Ignored if the role is not 'server'.

	// How should identifiers and files be cased?
	intfNameCasing: 'pascal' as NameCase,
	implNameCasing: 'pascal' as NameCase,
	jsonNameCasing: 'pascal' as NameCase,
	hndlNameCasing: 'pascal' as NameCase,
	mockNameCasing: 'pascal' as NameCase,
	enumNameCasing: 'pascal' as NameCase,
	enumElemCasing: 'camel' as NameCase,
	fileCasing: 'kebab' as NameCase,

	// What should identifiers end with?
	modelSuffix: '',
	apiSuffix: 'api',
	intfPrefix: '',
	intfSuffix: '',
	implPrefix: '',
	implSuffix: 'srvc',
	jsonPrefix: '',
	jsonSuffix: 'schema',
	hndlSuffix: 'handler',
	mockPrefix: 'mock',
	mockSuffix: '',
	intfFileSuffix: '',
	implFileSuffix: 'srvc',
	jsonFileSuffix: 'schema',
	hndlFileSuffix: 'handler',
	mockFileSuffix: 'mock',
	// Fine-grained control over how identifiers are named
	intfName_Tmpl: `#{name} #{typeSuffix} #{intfSuffix}`,
	implName_Tmpl: '#{name} #{typeSuffix} #{implSuffix}',
	jsonName_Tmpl: '#{name} #{jsonSuffix}',
	hndlName_Tmpl: '#{name} #{hndlSuffix}',
	mockName_Tmpl: '#{mockPrefix} #{name}',
	apiIntfName_Tmpl: null as string,
	apiImplName_Tmpl: null as string,
	modelIntfName_Tmpl: null as string,
	modelImplName_Tmpl: null as string,
	modelJsonName_Tmpl: null as string,
	// Fine-grained control over file names.
	fileBasename_Tmpl: '#{name}.#{typeSuffix}',
	intfFileBasename_Tmpl: '#{name} #{typeSuffix} #{intfFileSuffix}',
	implFileBasename_Tmpl: '#{name} #{typeSuffix} #{implFileSuffix}',
	jsonFileBasename_Tmpl: '#{name} #{jsonFileSuffix}',
	hndlFileBasename_Tmpl: '#{name} #{hndlFileSuffix}',
	mockFileBasename_Tmpl: '#{name} #{mockFileSuffix}',
	modelIntfFileBasename_Tmpl: null as string,
	modelImplFileBasename_Tmpl: null as string,
	modelJsonFileBasename_Tmpl: null as string,
	apiIntfFileBasename_Tmpl: null as string,
	apiImplFileBasename_Tmpl: null as string,
	reqArgBodyNames: [
		'body', 'reqBody', '_body', '_reqBody', 'requestBody', '_requestBody', '_MaybeYouShouldReThinkYourParameterNames'
	],

	role: 'client' as 'client' | 'server',
	target: 'browser' as 'browser' | 'node' | undefined,
	emitDescriptions: true,
	verboseJsonSchema: false
};

export type BaseSettingsType = Omit<typeof BaseSettings, '__conf_register'>;
export const BaseSettingsToken = Symbol.for(BaseSettings[RegisterConfigMarker]) as InjectableId<BaseSettingsType>;

export async function cleanOutDir(del: boolean | string, outDir: string, settings: BaseSettingsType): Promise<void> {
	// Clean up anything previously generated (if requested to do so).
	if (del) {
		if (del === 'all')
			rimrafSync(outDir, {recursive: true, force: true});   // This may make all the follow statements irrelevant, but not necessarily.
		if (settings.modelIntfDir)
			rimrafSync(path.join(outDir, settings.modelIntfDir), {recursive: true, force: true});
		if (settings.modelImplDir)
			rimrafSync(path.join(outDir, settings.modelImplDir), {recursive: true, force: true});
		if (settings.modelPrivDir)
			rimrafSync(path.join(outDir, settings.modelPrivDir), {recursive: true, force: true});
		if (settings.apiIntfDir)
			rimrafSync(path.join(outDir, settings.apiIntfDir), {recursive: true, force: true});
		if (settings.role !== 'server' && settings.apiImplDir)
			rimrafSync(path.join(outDir, settings.apiImplDir), {recursive: true, force: true});
		if (settings.apiPrivDir)
			rimrafSync(path.join(outDir, settings.apiPrivDir), {recursive: true, force: true});
		if (settings.apiHndlDir)
			rimrafSync(path.join(outDir, settings.apiHndlDir), {recursive: true, force: true});
	}
}
