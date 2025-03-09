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
	modelJsonDir: null as string,  // if truthy, json schema (for 3.x specs will be written to this directory).
	apiIntfDir: 'apis',  // if truthy, generate api interfaces
	apiImplDir: 'services',  // if truthy, generate api classes
	apiMockDir: null as string,  // if truthy, generate mock api classes; Ignored if the role is not 'client'.
	apiHndlDir: 'handlers', // Ignored if the role is not 'server'.

	// How should identifiers and files be cased?
	intfNameCasing: 'pascal' as NameCase,
	implNameCasing: 'pascal' as NameCase,
	jsonNameCasing: 'pascal' as NameCase,
	hndlNameCasing: 'camel' as NameCase,
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
	hndlPrefix: 'make',
	hndlSuffix: 'handler',
	mockPrefix: 'mock',
	mockSuffix: '',
	intfFileSuffix: '',
	implFileSuffix: 'srvc',
	jsonFileSuffix: 'schema',
	hndlFileSuffix: 'handler',
	mockFileSuffix: 'mock',
	// Fine-grained control over how identifiers are named
	intfName_Tmpl: `#{intfPrefix} #{name} #{typeSuffix} #{intfSuffix}`,
	implName_Tmpl: '#{implPrefix} #{name} #{typeSuffix} #{implSuffix}',
	jsonName_Tmpl: '#{jsonPrefix} #{name} #{jsonSuffix}',
	hndlName_Tmpl: '#{hndlPrefix} #{name} #{hndlSuffix}',
	mockName_Tmpl: '#{mockPrefix} #{name} #{mockSuffix} ',
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
		if (settings.modelImplDir && !(typeof del === 'string' && del.indexOf('keep-model-impl')))
			rimrafSync(path.join(outDir, settings.modelImplDir), {recursive: true, force: true});
		if (settings.modelJsonDir)
			rimrafSync(path.join(outDir, settings.modelJsonDir), {recursive: true, force: true});
		if (settings.apiIntfDir)
			rimrafSync(path.join(outDir, settings.apiIntfDir), {recursive: true, force: true});
		if (settings.apiImplDir && !(settings.role === 'server' && typeof del === 'string' && del.indexOf('keep-api-impl')))
			rimrafSync(path.join(outDir, settings.apiImplDir), {recursive: true, force: true});
		if (settings.apiMockDir && !(settings.role === 'client' && typeof del === 'string' && del.indexOf('keep-api-mock')))
			rimrafSync(path.join(outDir, settings.apiMockDir), {recursive: true, force: true});
		if (settings.apiHndlDir)
			rimrafSync(path.join(outDir, settings.apiHndlDir), {recursive: true, force: true});
	}
}
