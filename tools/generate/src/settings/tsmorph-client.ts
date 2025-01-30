import {Container, InjectableId} from 'async-injection';
import {InitializeMarker, InitializerFn, RegisterConfigMarker} from 'dyflex-config';

// @ts-ignore
export const TsMorphClientSettings = {
	[RegisterConfigMarker]: 'CODE_GEN_TSMORPH_CLIENT',
	httplib: undefined as unknown as string,
	support: {
		// Full (parent) path name to the files to be copied into the target support directory
		srcDirName: `${__dirname}/../generators/tsmorph/client/support`,
		// Always specified relative to apiIntfDir
		dstDirName: '../internal',
		// Source files to be copied into the internal support directory.
		// Path should be relative to 'srcDirName'
		files: [
			`client-types.ts`,
			{'client-request.ts': `client-request#{target}.ts`},
			`client-config.ts`,
			`param-serializers.ts`,
			`http-client.ts`,
			`index.ts`,
		]
	},
	dependencyInjection: 'async-injection' as unknown as ('async-injection' | 'angular'),
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
				]
			},
			// Really tried to avoid templating, but given the differences in DI impls, this lodash template was unavoidable.
			// NOTE: Relative imports are more difficult to determine, so the code handles importing the Token and Class.
			apiSetup: `import { Container } from 'async-injection';
						export function setup(di: Container, httpClient: ApiHttpClient, defaultConfig?: ApiClientConfig): void {
							if (!di.isIdKnown(ApiHttpClientToken)) 
								di.bindConstant(ApiHttpClientToken, httpClient);<% apis.forEach(function(api) { %>
							if (!di.isIdKnown(<%- api.getIdentifier('intf') %><%- intfTokensExt %>)) {
								if (defaultConfig && (!di.isIdKnown(<%- api.getIdentifier('impl') %>Config<%- intfTokensExt %>)))
									di.bindConstant(<%- api.getIdentifier('impl') %>Config<%- intfTokensExt %>, defaultConfig);
								di.bindClass(<%- api.getIdentifier('intf') %><%- intfTokensExt %>, <%- api.getIdentifier('impl') %>).asSingleton();
							}<% }); %>
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
				]
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
						    { provide: <%- api.getIdentifier('intf') %><%- intfTokensExt %>, useClass: <%- api.getIdentifier('impl') %> },<% }); %>
						  ]
						})
						export class ApiModule {
						    public static forRoot(httpClientFcty: (angularHttpClient: HttpClient) => ApiHttpClient, apiConfFcty: (key: string) => ApiClientConfig): ModuleWithProviders<ApiModule> {
						        return {
						            ngModule: ApiModule,
						            providers: [<% apis.forEach(function(api) { %>
						                { provide: <%- api.getIdentifier('impl') %><%- confTokensExt %>, useFactory: apiConfFcty, deps: ["<%- api.getIdentifier('intf') %>"]},<% }); %>
						                { provide: ApiHttpClientToken, useFactory: httpClientFcty, deps: [HttpClient] } 
						            ]
						        };
						    }
						    constructor( @Optional() @SkipSelf() parentModule: ApiModule) {
						        if (parentModule)
						            throw new Error('ApiModule is already loaded. Import in your base AppModule only.');
						    }
						}
					`
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
