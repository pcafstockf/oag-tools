import {Container, InjectableId} from 'async-injection';
import {InitializeMarker, InitializerFn, RegisterConfigMarker} from 'dyflex-config';

export const TsMorphClientSettings = {
	[RegisterConfigMarker]: 'CODE_GEN_TSMORPH_CLIENT',
	httpsup: 'fetch' as 'fetch' | 'axios' | 'node' | 'angular' | undefined,
	mocklib: 'node' as 'node' | 'sinon' | 'jasmine' | undefined,
	spy: {
		'node': {
			imphort: [{
				moduleSpecifier: 'node:test',
				namedImports: ['mock', 'Mock']
			}],
			method: {
				inner: `
					(<% params.forEach(function(p, i) { %><% print(i > 0 ? ', ' + p.name : p.name) %><% print(p.required ? '' : '?') %>: <% print(p.typeText) %><% }); %>): Promise<<% print(returnText) %>>;
					(<% params.forEach(function(p, i) { %><% print(i > 0 ? ', ' + p.name : p.name) %><% print(p.required ? '' : '?') %>: <% print(p.typeText) %><% }); %><% print(params.length > 0 ? ', ' : '') %>rsp?: 'http'): Promise<HttpResponse<<% print(returnText) %>>>;
					(<% params.forEach(function(p, i) { %><% print(i > 0 ? ', ' + p.name : p.name) %><% print(p.required ? '' : '?') %>: <% print(p.typeText) %><% }); %><% print(params.length > 0 ? ', ' : '') %>hdrs?: Record<string, string>): Promise<<% print(returnText) %>>;
					(<% params.forEach(function(p, i) { %><% print(i > 0 ? ', ' + p.name : p.name) %><% print(p.required ? '' : '?') %>: <% print(p.typeText) %><% }); %><% print(params.length > 0 ? ', ' : '') %>hdrs?: Record<string, string>, rsp?: 'http'): Promise<HttpResponse<<% print(returnText) %>>>;
				`,
				outer: `Mock<{
					<% print(innerTxt) %>
				}>`
			},
			methodInit: `
				mock.fn(async (<% params.forEach(function(p, i) { %><% print(i > 0 ? ', ' + p.name : p.name) %><% print(p.required ? '' : '?') %>: <% print(p.typeText) %><% }); %><% print(params.length > 0 ? ', ' : '') %>hdrsOrRsp?: Record<string, string> | 'body' | 'http', rsp?: 'body' | 'http') => {<% if (modelSchema) {  %>
					const data = this.mdg.genMockData<<% print(returnText) %>>(<% print(modelSchema) %>);
					if (hdrsOrRsp === 'http' || rsp === 'http')
						return {
							status: <% print(preferredStatus ?? 200) %>,
							headers: {},    // Can we compute this from the spec?
							data: data
						}
					return data;<% } %>
				})
			`
		},
		'sinon': {
			imphort: [{
				moduleSpecifier: 'sinon',
				namedImports: ['fake', 'SinonSpy', 'SinonStub']
			}],
			method: {
				inner: `
					SinonStub<[<% params.forEach(function(p, i) { %><% print(i > 0 ? ', ' : '') %><% print(p.typeText) %><% print(p.required ? '' : '?') %><% }); %>], Promise<<% print(returnText) %>>> &
					SinonStub<[<% params.forEach(function(p, i) { %><% print(i > 0 ? ', ' : '') %><% print(p.typeText) %><% print(p.required ? '' : '?') %><% }); %><% print(params.length > 0 ? ', ' : '') %>'http'?], Promise<HttpResponse<<% print(returnText) %>>>> &
					SinonStub<[<% params.forEach(function(p, i) { %><% print(i > 0 ? ', ' : '') %><% print(p.typeText) %><% print(p.required ? '' : '?') %><% }); %><% print(params.length > 0 ? ', ' : '') %>Record<string, string>?], Promise<<% print(returnText) %>>> &
					SinonStub<[<% params.forEach(function(p, i) { %><% print(i > 0 ? ', ' : '') %><% print(p.typeText) %><% print(p.required ? '' : '?') %><% }); %><% print(params.length > 0 ? ', ' : '') %>Record<string, string>?, 'http'?], Promise<HttpResponse<<% print(returnText) %>>>>`,
				outer: '<% print(innerTxt) %>'
			},
			methodInit: `
				fake(async (<% params.forEach(function(p, i) { %><% print(i > 0 ? ', ' + p.name : p.name) %><% print(p.required ? '' : '?') %>: <% print(p.typeText) %><% }); %><% print(params.length > 0 ? ', ' : '') %>hdrsOrRsp?: Record<string, string> | 'body' | 'http', rsp?: 'body' | 'http') => {<% if (modelSchema) {  %>
					const data = this.mdg.genMockData<<% print(returnText) %>>(<% print(modelSchema) %>);
					if (hdrsOrRsp === 'http' || rsp === 'http')
						return {
							status: <% print(preferredStatus ?? 200) %>,
							headers: {},    // Can we compute this from the spec?
							data: data
						} as HttpResponse<<% print(returnText) %>>;
					return data;<% } %>
				})
			`
		},
		'jasmine': {
			// NOTE: To ue jasmine spies in an actual application (as opposed to a test runner), you must:
			//    import jasmine from 'jasmine';
			//    new jasmine();
			// *before* any attempt to construct a mocked api service (perhaps the first 2 lines of your main.ts).
			imphort: [{
				moduleSpecifier: 'jasmine'
			}],
			method: {
				inner: `
					jasmine.Spy<(<% params.forEach(function(p, i) { %><% print(i > 0 ? ', ' + p.name : p.name) %><% print(p.required ? '' : '?') %>: <% print(p.typeText) %><% }); %>) => Promise<<% print(returnText) %>>> &
					jasmine.Spy<(<% params.forEach(function(p, i) { %><% print(i > 0 ? ', ' + p.name : p.name) %><% print(p.required ? '' : '?') %>: <% print(p.typeText) %><% }); %><% print(params.length > 0 ? ', ' : '') %>rsp?: 'http') => Promise<HttpResponse<<% print(returnText) %>>>> &
					jasmine.Spy<(<% params.forEach(function(p, i) { %><% print(i > 0 ? ', ' + p.name : p.name) %><% print(p.required ? '' : '?') %>: <% print(p.typeText) %><% }); %><% print(params.length > 0 ? ', ' : '') %>hdrs?: Record<string, string>) => Promise<<% print(returnText) %>>> &
					jasmine.Spy<(<% params.forEach(function(p, i) { %><% print(i > 0 ? ', ' + p.name : p.name) %><% print(p.required ? '' : '?') %>: <% print(p.typeText) %><% }); %><% print(params.length > 0 ? ', ' : '') %>hdrs?: Record<string, string>, rsp?: 'http') => Promise<HttpResponse<<% print(returnText) %>>>>
				`,
				outer: `<% print(innerTxt) %>`
			},
			methodInit: `
				jasmine.createSpy().and.callFake(async (<% params.forEach(function(p, i) { %><% print(i > 0 ? ', ' + p.name : p.name) %><% print(p.required ? '' : '?') %>: <% print(p.typeText) %><% }); %><% print(params.length > 0 ? ', ' : '') %>hdrsOrRsp?: Record<string, string> | 'body' | 'http', rsp?: 'body' | 'http') => {<% if (modelSchema) {  %>
					const data = this.mdg.genMockData<<% print(returnText) %>>(<% print(modelSchema) %>);
					if (hdrsOrRsp === 'http' || rsp === 'http')
						return {
							status: <% print(preferredStatus ?? 200) %>,
							headers: {},    // Can we compute this from the spec?
							data: data
						} as HttpResponse<<% print(returnText) %>>;
					return data;<% } %>
				})
			`
		}
	},
	// Always specified relative to apiIntfDir
	internalDirName: '../internal',
	support: [{
		// Full (parent) path name to the files to be copied into the target support directory
		srcDirName: `${__dirname}/../generators/tsmorph/support`,
		// Source files to be copied into the internal support directory.
		// Path should be relative to 'srcDirName'
		files: [
			`data-mocking.ts`
		]
	}, {
		// Full (parent) path name to the files to be copied into the target support directory
		srcDirName: `${__dirname}/../generators/tsmorph/client/support`,
		// Source files to be copied into the internal support directory.
		// Path should be relative to 'srcDirName'
		files: [
			`client-types.ts`,
			{'client-transformers.ts': `client-transformers#{target}.ts`},
			`client-config.ts`,
			`param-serializers.ts`,
			{'body-serializer.ts': `body-serializer#{httpsup}.ts`},
			`http-client.ts`,
			{'http-client-svc.ts': `http-client#{httpsup}.ts`},
			`index.ts`,
		]
	}],
	dependencyInjection: 'async-injection' as 'async-injection' | 'angular' | undefined,
	di: {
		'async-injection': {
			// This is my project ;-) so by default I'm promoting the best TypeScript DI!
			intfImport: [{
				moduleSpecifier: 'async-injection',
				namedImports: ['InjectionToken']
			}],
			implImport: [{
				moduleSpecifier: 'async-injection',
				namedImports: ['Injectable', 'Inject', 'Optional', 'InjectableId']
			}],
			apiIntfTokens: [{
				name_Tmpl: '#{intfName}Token',
				initializer_Tmpl: 'new InjectionToken<#{intfName}>(\'#{intfLabel}\')'
			}],
			apiImplTokens: [{
				name_Tmpl: '#{implName}ConfigToken',
				initializer_Tmpl: 'Symbol.for(\'#{intfLabel}ClientConfig\') as InjectableId<ApiClientConfig>'
			}],
			apiConstruction: {
				implDecorator: [{
					name: 'Injectable',
					arguments: [] as string[]
				}],
				httpClientInject: [
					{name: 'Inject', arguments: ['ApiHttpClientToken']}
				],
				apiConfigInject: [
					{name: 'Inject', arguments: ['#{implName}ConfigToken']},
					{name: 'Optional', arguments: []}
				],
				apiMockInject: [
					{name: 'Inject', arguments: ['MockDataGeneratorToken']}
				],
			},
			// Really tried to avoid templating, but given the differences in DI impls, this lodash template was unavoidable.
			// NOTE: Relative imports are more difficult to determine, so the code handles importing the Token and Class.
			apiSetup: `import { Container } from 'async-injection';
						export function setupApis(di: Container, httpClient: ApiHttpClient, defaultConfig?: ApiClientConfig): void {
							if (!di.isIdKnown(ApiHttpClientToken)) 
								di.bindConstant(ApiHttpClientToken, httpClient);<% apis.forEach(function(api) { %>
							if (defaultConfig && (!di.isIdKnown(<%- api.getIdentifier('impl') %>Config<%- intfTokensExt %>)))
								di.bindConstant(<%- api.getIdentifier('impl') %>Config<%- intfTokensExt %>, defaultConfig);
							if (!di.isIdKnown(<%- api.getIdentifier() %><%- intfTokensExt %>))
								di.bindClass(<%- api.getIdentifier() %><%- intfTokensExt %>, <%- api.getIdentifier('impl') %>).asSingleton();<% }); %>
						}
					`,
			mockSetup: `import { Container } from 'async-injection';
						export function setupMocks(di: Container, mdg?: MockDataGenerator): void {
							if (mdg && !di.isIdKnown(MockDataGeneratorToken)) 
								di.bindConstant(MockDataGeneratorToken, mdg);<% apis.forEach(function(api) { %>
							if (!di.isIdKnown(<%- api.getIdentifier() %><%- intfTokensExt %>))
								di.bindClass(<%- api.getIdentifier() %><%- intfTokensExt %>, <%- api.getIdentifier('mock') %>).asSingleton();<% }); %>
						}
					`
		},
		'angular': {
			intfImport: [{
				moduleSpecifier: '@angular/core',
				namedImports: ['InjectionToken']
			}],
			implImport: [{
				moduleSpecifier: '@angular/core',
				namedImports: ['Inject', 'Injectable', 'Optional', 'InjectionToken']
			}],
			apiIntfTokens: [{
				name_Tmpl: '#{intfName}Token',
				initializer_Tmpl: 'new InjectionToken<#{intfName}>(\'#{intfLabel}\')'
			}],
			apiImplTokens: [{
				name_Tmpl: '#{implName}ConfigToken',
				initializer_Tmpl: 'new InjectionToken<ApiClientConfig>(\'#{intfLabel}ClientConfig\')'
			}],
			apiImplExports: [{
				name_Tmpl: '#{intfName}Token'
			}],
			apiConstruction: {
				implDecorator: [{
					name: 'Injectable',
					arguments: [] as string[]
				}],
				httpClientInject: [
					{name: 'Inject', arguments: ['ApiHttpClientToken']}
				],
				apiConfigInject: [
					{name: 'Inject', arguments: ['#{implName}ConfigToken']},
					{name: 'Optional', arguments: []}
				],
				apiMockInject: [
					{name: 'Inject', arguments: ['MockDataGeneratorToken']}
				],
			},
			// might need useValue
			apiSetup: `
						import { NgModule, ModuleWithProviders, SkipSelf, Optional } from '@angular/core';
						import {HttpClientModule, HttpClient} from "@angular/common/http";
						@NgModule({
						  imports:      [HttpClientModule],
						  declarations: [],
						  exports:      [],
						  providers: [<% apis.forEach(function(api) { %>
						    { provide: <%- api.getIdentifier() %><%- intfTokensExt %>, useClass: <%- api.getIdentifier('impl') %> },<% }); %>
						  ]
						})
						export class ApiModule {
						    public static forRoot(httpClientFcty: (angularHttpClient: HttpClient) => ApiHttpClient, apiConfFcty: (key: string) => ApiClientConfig): ModuleWithProviders<ApiModule> {
						        return {
						            ngModule: ApiModule,
						            providers: [<% apis.forEach(function(api) { %>
						                { provide: <%- api.getIdentifier('impl') %><%- confTokensExt %>, useFactory: apiConfFcty, deps: ["<%- api.getIdentifier() %>"]},<% }); %>
						                { provide: ApiHttpClientToken, useFactory: httpClientFcty, deps: [HttpClient] } 
						            ]
						        };
						    }
						    constructor( @Optional() @SkipSelf() parentModule: ApiModule) {
						        if (parentModule)
						            throw new Error('ApiModule is already loaded. Import in your base AppModule only.');
						    }
						}
					`,
			mockSetup: ''
		}
	},
	[InitializeMarker]: {
		fn: (() => {
			return;
		}) as InitializerFn<Container>
	}
};

export type TsMorphClientSettingsType = Omit<typeof TsMorphClientSettings, '__conf_register' | '__conf_init'>;
export const TsMorphClientSettingsToken = Symbol.for(TsMorphClientSettings[RegisterConfigMarker]) as InjectableId<TsMorphClientSettingsType>;
