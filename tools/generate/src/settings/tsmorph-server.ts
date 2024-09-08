import {InjectableId} from 'async-injection';

export const TsMorphServerSettings = {
	__conf_register: 'CODE_GEN_TSMORPH_SERVER',

	// The framework should actually be the npm package name.
	framework: 'openapi-backend' as ('openapi-backend' | 'express-openapi-validator' | 'fastify-openapi-glue'),
	'openapi-backend': {
		stubReturn: 'null',
		context: {
			type: 'Context',
			imphorts: [{
				moduleSpecifier: 'openapi-backend',
				namedImports: ['Context']
			}],
		},
		hndl: {
			imphorts: [{
				moduleSpecifier: 'openapi-backend',
				namedImports: ['Context', 'Handler']
			}, {
				moduleSpecifier: 'express',
				namedImports: ['Request', 'Response', 'NextFunction']
			}, {
				moduleSpecifier: '#{internal}',
				namedImports: ['processApiResult']
			}],
			lookup: {
				body: 'ctx.request.requestBody',
				query: 'ctx.request.query.#{name}',
				path: 'ctx.request.params.#{name}',
				header: 'ctx.request.headers.#{name}',
				cookie: `ctx.request.cookies['#{name}']`
			},
			body: `(ctx: Context<#{body}, #{path}, #{query}, #{header}, #{cookie}>, _: Request, res: Response, next: NextFunction) => {
						\tconst result = #{apiInvocation};
						\treturn processApiResult(ctx as unknown as Context, result, res, next);
						}`,
			cast: '{[operationId: string]: Handler;}'
		}
	},
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
			body: `(req: FastifyRequest<{Body: #{body}, Params: #{path}, Querystring: #{query}, Headers: #{header}, Reply: #{reply}}>, rsp: FastifyReply) => {
						\tconst ctx = {request: req, response: rsp};
						\tconst result = #{apiInvocation};
						\treturn processApiResult(req, result, rsp);
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
			body: `(req: Request<#{path}, #{reply}, #{body}, #{query}>, res: Response<#{reply}>, next: NextFunction) => {
						\tconst ctx = {request: req, response: res};
						\tconst result = #{apiInvocation};
						\treturn processApiResult(req as unknown as Request, result, res as unknown as Response, next);
						}`,
			cast: 'Record<string, RequestHandler>'
		}
	},
	support: {
		// Full (parent) path name to the files to be copied into the target support directory
		srcDirName: `${__dirname}/../typescript/server/support`,
		// Always specified relative to apiIntfDir
		dstDirName: '../internal',
		// Source files to be copied into the internal support directory.
		// Path should be relative to 'srcDirName'
		files: [
			`index.ts`,
			`http-response.ts`,
			// This file is to complex to generate the code; Copy an appropriate framework template.
			{'framework-utils.ts': `#{framework}_framework-utils.ts`}
		]
	},
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
	}
};

export type TsMorphServerSettingsType = Omit<typeof TsMorphServerSettings, '__conf_register'>;
export const TsMorphServerSettingsToken = Symbol.for(TsMorphServerSettings.__conf_register) as InjectableId<TsMorphServerSettingsType>;

