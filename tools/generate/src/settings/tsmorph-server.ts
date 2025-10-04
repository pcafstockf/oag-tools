import {Container, InjectableId} from 'async-injection';
import {InitializeMarker, InitializerFn, RegisterConfigMarker} from 'dyflex-config';

export const TsMorphServerSettings = {
	[RegisterConfigMarker]: 'CODE_GEN_TSMORPH_SERVER',

	// The framework should actually be the npm package name.
	framework: 'express-openapi-validator' as ('express-openapi-validator' | 'fastify-openapi-glue'),
	'fastify-openapi-glue': {
		stubReturn: 'null',
		context: {
			type: 'Context',
			imphorts: [{
				moduleSpecifier: '#{internal}',
				namedImports: ['Context']
			}],
		},
		hndl: {
			imphorts: [{
				moduleSpecifier: 'fastify',
				namedImports: ['FastifyRequest', 'FastifyReply']
			}, {
				moduleSpecifier: '#{internal}',
				namedImports: ['Context', 'processApiResult']
			}],
			lookup: {
				body: 'req.body',
				query: 'req.query.#{name}',
				path: 'req.params.#{name}',
				header: 'req.headers.#{name} as #{type}',
				cookie: `req.cookies['#{name}']`   // This presumes the presence of @fastify/cookie
			},
			operationId: undefined as string,
			queryCleaner: undefined as string,
			body: `(req: FastifyRequest<{Body: #{body}, Params: #{path}, Querystring: #{query}, Headers: #{header}, Reply: #{reply}}>, rsp: FastifyReply) => {
						\tapi.storage.run({request: req, response: rsp}, () => {
						\t\tconst result = #{apiInvocation};
						\t\treturn utils.processApiResult(req, result, rsp);
						\t});
						}`,
			cast: undefined as unknown as string
		}
	},
	'express-openapi-validator': {
		stubReturn: 'null',
		context: {
			type: 'Context',
			imphorts: [{
				moduleSpecifier: '#{internal}',
				namedImports: ['Context']
			}],
		},
		hndl: {
			imphorts: [{
				moduleSpecifier: 'express',
				namedImports: ['Request', 'Response', 'NextFunction', 'RequestHandler']
			}, {
				moduleSpecifier: '#{internal}',
				namedImports: ['Context', 'processApiResult']
			}],
			lookup: {
				body: 'req.body',
				query: 'req.query.#{name}',
				path: 'req.params.#{name}',
				header: `req.headers['#{name}'] as string`,
				cookie: `req.cookies['#{name}']`
			},
			operationId: '"$#{pattern}!#{method}"',
			queryCleaner: `\tif (req.query.#{name} && typeof req.query.#{name} === 'object') {
						\t\treq.query = { ...req.query.#{name}, ...req.query };
						\t\tdelete req.query.#{name};
						\t}`,
			body: `(req: Request<#{path}, #{reply}, #{body}, #{query}>, res: Response<#{reply}>, next: NextFunction) => {
						#{queryCleaner}\treturn api.storage.run({request: req, response: res}, () => {
						\t\tconst result = #{apiInvocation};
						\t\treturn utils.processApiResult(req as unknown as Request, result, res, next);
						\t});
						}`,
			cast: 'Record<string, RequestHandler>'
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
		srcDirName: `${__dirname}/../generators/tsmorph/server/support`,
		// Source files to be copied into the internal support directory.
		// Path should be relative to 'srcDirName'
		files: [
			`index.ts`,
			`http-response.ts`,
			// This file is to complex to generate the code; Copy an appropriate framework template.
			{'framework-utils.ts': `#{framework}_framework-utils.ts`}
		]
	}],
	dependencyInjection: 'async-injection' as unknown as ('async-injection'),
	di: {
		'async-injection': {
			// This is my project ;-) so by default I'm promoting the best TypeScript DI!
			intfImport: [{
				moduleSpecifier: 'async-injection',
				namedImports: ['InjectionToken']
			}],
			implImport: [{
				moduleSpecifier: 'async-injection',
				namedImports: ['Injectable', 'Inject']
			}],
			apiIntfTokens: [{
				name_Tmpl: '#{intfName}Token',
				initializer_Tmpl: 'new InjectionToken<#{intfName}>(\'#{intfLabel}\')'
			}],
			apiConstruction: {
				implDecorator: [{
					name: 'Injectable',
					arguments: [] as string[]
				}]
			},
			apiSetup: `import { Container } from 'async-injection';
							export function setup(di: Container): void {<% apis.forEach(function(api) { %>
								if (!di.isIdKnown(<%- api.getIdentifier('intf') %>Token)) 
									di.bindClass(<%- api.getIdentifier('intf') %>Token, <%- api.getIdentifier('impl') %>).asSingleton();<% }); %>
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

export type TsMorphServerSettingsType = Omit<typeof TsMorphServerSettings, '__conf_register' | '__conf_init'>;
export const TsMorphServerSettingsToken = Symbol.for(TsMorphServerSettings[RegisterConfigMarker]) as InjectableId<TsMorphServerSettingsType>;

