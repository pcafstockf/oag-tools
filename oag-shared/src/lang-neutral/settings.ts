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

	// artifact wraps
	modelPrefix: '',
	modelSuffix: '',
	apiPrefix: '',
	apiSuffix: '',
	// type wraps
	modelIntfPrefix: ' ',
	modelIntfSuffix: ' ',
	modelImplPrefix: ' ',
	modelImplSuffix: ' dto',
	modelJsonPrefix: ' ',
	modelJsonSuffix: ' schema',
	apiIntfPrefix: ' ',
	apiIntfSuffix: ' api',
	apiImplPrefix: ' ',
	apiImplSuffix: ' srvc',
	apiHndlPrefix: 'make',
	apiHndlSuffix: ' handler',
	apiMockPrefix: ' mock',
	apiMockSuffix: ' ',
	//
	fileSuffixSep: ' ',
	// file type extensions
	modelIntfFileSuffix: '',
	modelImplFileSuffix: 'dto',
	modelJsonFileSuffix: 'schema',
	apiIntfFileSuffix: '',
	apiImplFileSuffix: 'srvc',
	apiHndlFileSuffix: 'handler',
	apiMockFileSuffix: 'mock',
	// Fine-grained control over artifact names.
	modelIntfName_Tmpl: `<%= fn.relTo('.').modelIntfPrefix %><%= fn.relTo('.').modelPrefix %>#{name}<%= fn.relTo('.').modelSuffix%><%= fn.relTo('.').modelIntfSuffix %>`,
	modelImplName_Tmpl: `<%= fn.relTo('.').modelImplPrefix%><%= fn.relTo('.').modelPrefix %>#{name}<%= fn.relTo('.').modelSuffix%><%= fn.relTo('.').modelImplSuffix %>`,
	modelJsonName_Tmpl: `<%= fn.relTo('.').modelJsonPrefix%><%= fn.relTo('.').modelPrefix %>#{name}<%= fn.relTo('.').modelSuffix%><%= fn.relTo('.').modelJsonSuffix %>`,
	apiIntfName_Tmpl: `<%= fn.relTo('.').apiIntfPrefix%><%= fn.relTo('.').apiPrefix %>#{name}<%= fn.relTo('.').apiSuffix%><%= fn.relTo('.').apiIntfSuffix %>`,
	apiImplName_Tmpl: `<%= fn.relTo('.').apiImplPrefix%><%= fn.relTo('.').apiPrefix %>#{name}<%= fn.relTo('.').apiSuffix%><%= fn.relTo('.').apiImplSuffix %>`,
	apiHndlName_Tmpl: `<%= fn.relTo('.').apiHndlPrefix%><%= fn.relTo('.').apiPrefix %>#{name}<%= fn.relTo('.').apiSuffix%><%= fn.relTo('.').apiHndlSuffix %>`,
	apiMockName_Tmpl: `<%= fn.relTo('.').apiMockPrefix%><%= fn.relTo('.').apiPrefix %>#{name}<%= fn.relTo('.').apiSuffix%><%= fn.relTo('.').apiMockSuffix %>`,
	// Fine-grained control over file names.
	modelIntfFileBasename_Tmpl: `<%= fn.relTo('.').modelPrefix %>#{name}<%= fn.relTo('.').modelSuffix %><%= fn.relTo('.').fileSuffixSep %><%= fn.relTo('.').modelIntfFileSuffix %>`,
	modelImplFileBasename_Tmpl: `<%= fn.relTo('.').modelPrefix %>#{name}<%= fn.relTo('.').modelSuffix %><%= fn.relTo('.').fileSuffixSep %><%= fn.relTo('.').modelImplFileSuffix %>`,
	modelJsonFileBasename_Tmpl: `<%= fn.relTo('.').modelPrefix %>#{name}<%= fn.relTo('.').modelSuffix %><%= fn.relTo('.').fileSuffixSep %><%= fn.relTo('.').modelJsonFileSuffix %>`,
	apiIntfFileBasename_Tmpl: `<%= fn.relTo('.').apiPrefix %>#{name}<%= fn.relTo('.').apiSuffix %><%= fn.relTo('.').fileSuffixSep %><%= fn.relTo('.').apiIntfFileSuffix %>`,
	apiImplFileBasename_Tmpl: `<%= fn.relTo('.').apiPrefix %>#{name}<%= fn.relTo('.').apiSuffix %><%= fn.relTo('.').fileSuffixSep %><%= fn.relTo('.').apiImplFileSuffix %>`,
	apiHndlFileBasename_Tmpl: `<%= fn.relTo('.').apiPrefix %>#{name}<%= fn.relTo('.').apiSuffix %><%= fn.relTo('.').fileSuffixSep %><%= fn.relTo('.').apiHndlFileSuffix %>`,
	apiMockFileBasename_Tmpl: `<%= fn.relTo('.').apiPrefix %>#{name}<%= fn.relTo('.').apiSuffix %><%= fn.relTo('.').fileSuffixSep %><%= fn.relTo('.').apiMockFileSuffix %>`,
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
		if (settings.modelImplDir) {
			const keep = typeof del === 'string' && del.indexOf('keep-model-impl') >= 0;
			if (!keep)
				rimrafSync(path.join(outDir, settings.modelImplDir), {recursive: true, force: true});
		}
		if (settings.modelJsonDir)
			rimrafSync(path.join(outDir, settings.modelJsonDir), {recursive: true, force: true});
		if (settings.apiIntfDir)
			rimrafSync(path.join(outDir, settings.apiIntfDir), {recursive: true, force: true});
		if (settings.apiImplDir) {
			const keep = settings.role === 'server' && typeof del === 'string' && del.indexOf('keep-api-impl') >= 0;
			if (!keep)
				rimrafSync(path.join(outDir, settings.apiImplDir), {recursive: true, force: true});
		}
		if (settings.apiMockDir) {
			const keep = settings.role === 'client' && typeof del === 'string' && del.indexOf('keep-api-mock') >= 0;
			if (!keep)
				rimrafSync(path.join(outDir, settings.apiMockDir), {recursive: true, force: true});
		}
		if (settings.apiHndlDir)
			rimrafSync(path.join(outDir, settings.apiHndlDir), {recursive: true, force: true});
	}
}
