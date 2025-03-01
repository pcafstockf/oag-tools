import cookie from '@fastify/cookie';
import Ajv from 'ajv';
import type {Schema, ValidateFunction} from 'ajv/lib/types';
import {FastifyInstance, FastifyReply, FastifyRequest, FastifySchema, RouteOptions} from 'fastify';
import {OpenAPIV3_1} from 'openapi-types';
import {DefaultMockDataGenerator, findDefaultStatusCodeMatch, MockResponseDescription} from './data-mocking';
import {HttpResponse} from './http-response';

/**
 * Every Api/Service method receives this as its first parameter.
 */
export interface Context {
	request: FastifyRequest;
	response: FastifyReply;
}

/**
 * @inheritDoc
 * Additional support functions specific to fastify-openapi-glue.
 */
export class FrameworkUtils extends DefaultMockDataGenerator {
	constructor(mockGenFn?: (s: { type: string }) => any, preferExamples?: boolean) {
		super(mockGenFn, preferExamples);
	}

	/**
	 * Handlers call an appropriate Api/Service method, and this method processes those responses. <br/>
	 * Every Api/Service method is passed a 'ctx' object of type {request: FastifyRequest; response: FastifyReply} (aka @see Context).
	 * <br/>
	 * Every Api/Service method should:<ul>
	 *  <li>Return Promise<{@link HttpResponse}> to send back the response.
	 *  <li>Return Promise<null> to signify that the method has fully handled the response and no further action is needed.
	 *  <li>Return null to indicate a mock response should be provided using <a href="https://openapistack.co/docs/openapi-backend/api/#mockresponseforoperationoperationid-opts">openapi-backend mocking</a>.
	 *  <li>Throw an Error (or 'route' / 'router') to indicate the 'next' handler in the chain should be called with that "error".
	 *  <li>Throw null | undefined to indicate the 'next' handler in the chain should be called with no args.
	 * </ul>
	 */
	processApiResult<T>(req: FastifyRequest, result: Promise<HttpResponse<T>> | null, res: FastifyReply) {
		if (typeof result === 'object' && (result instanceof Promise || typeof (result as any)?.then === 'function')) {
			return result.then(r => {
				if (r) {
					if (r.headers && typeof r.headers === 'object')
						res.headers(r.headers as any);
					res.status(r.status ?? 200);
					if (typeof r.data === 'undefined')
						return res.send();
					else
						return res.send(r.data);
				}
				// else, remember that undefined means it has been handled and we should do nothing.
			});
		}
		else {
			let rspStatus = 501;
			let rspData = undefined;
			let hdrs = undefined;
			if ((req.routeOptions.config as any).response) {
				const mockRsp = this.genMockResponse((req.routeOptions.config as any).response as MockResponseDescription, req.url);
				if (typeof mockRsp?.status === 'number')
					rspStatus = mockRsp.status;
				if (mockRsp.data)
					rspData = mockRsp.data;
				if (mockRsp.headers)
					hdrs = mockRsp.headers;
			}
			if (hdrs)
				return res.headers(hdrs);
			res.status(rspStatus);
			if (rspData)
				return res.send(rspData);
			return res.send();
		}
	}

	/**
	 * Add cookie schema validation to Fastify.
	 */
	static GlueCookie(fastify: FastifyInstance, ajv: Ajv) {
		// Register the fastify-cookie plugin for cookie parsing
		fastify.register(cookie);

		// Hook into the route registration process to compile cookie schemas
		fastify.addHook('onRoute', (routeOptions: RouteOptions) => {
			const schema = routeOptions.schema as FastifySchema & { cookies: Schema };
			if (schema?.cookies) {
				// Compile the cookie schema once and store it in the route's context
				routeOptions.config = routeOptions.config || {};
				(routeOptions.config as any).cookieValidator = ajv.compile(schema.cookies);
			}
		});

		// Pre-handler hook to validate cookies using the precompiled schema
		fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
			const cookieValidator = (request.routeOptions.config as any).cookieValidator as ValidateFunction;
			if (cookieValidator) {
				const valid = cookieValidator(request.cookies);
				if (!valid) {
					reply.status(400).send({error: 'Invalid cookies', details: cookieValidator.errors});
					throw new Error('Invalid cookies');
				}
			}
		});
	}

	/**
	 * Add support for returning mock data from unimplemented endpoints.
	 * This function finds the default application/json response (as specified in the OpenApi document) for each operation,
	 * and sets routeOptions.config.response of that operation to contain the status code and OpenAPIV3_1.MediaTypeObject values.
	 */
	static GlueDefaultRspContent(fastify: FastifyInstance, doc: OpenAPIV3_1.Document) {
		// Hook into the route registration process to extract examples from the specification
		fastify.addHook('onRoute', (routeOptions: RouteOptions) => {
			const pi = doc.paths[routeOptions.url.replace(/:([^\/]+)/g, '{$1}')];
			const meth = (routeOptions.method as string).toLowerCase() as OpenAPIV3_1.HttpMethods;
			routeOptions.config = routeOptions.config || {};
			if (pi[meth]?.responses)
				(routeOptions.config as any).response = findDefaultStatusCodeMatch(pi[meth].responses);
		});
	}
}
