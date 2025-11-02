import {NextFunction, Request, Response} from 'express';
import {DefaultMockDataGenerator, findDefaultStatusCodeMatch} from './data-mocking';
import {HttpResponse} from './http-response';

export interface Context {
	request: Request;
	response: Response;
}

/**
 * @inheritDoc
 * Additional support functions specific to fastify-openapi-glue.
 */
export class FrameworkUtils extends DefaultMockDataGenerator {
	constructor(mockGenFn?: (s: { type: string | string[] }) => any, preferExamples?: boolean) {
		super(mockGenFn, preferExamples);
	}

	/**
	 * Handlers call an appropriate Api/Service method, and this method processes those responses. <br/>
	 * Every Api/Service method is passed a 'ctx' object of type {request: Request; response: Response} (aka @see Context).
	 * <br/>
	 * Every Api/Service method should:<ul>
	 *  <li>Return Promise<{@link HttpResponse}> to send back the response.
	 *  <li>Return Promise<null> to signify that the method has fully handled the response and no further action is needed.
	 *  <li>Return null to indicate a mock response should be provided using <a href="https://openapistack.co/docs/openapi-backend/api/#mockresponseforoperationoperationid-opts">openapi-backend mocking</a>.
	 *  <li>Throw an Error (or 'route' / 'router') to indicate the 'next' handler in the chain should be called with that "error".
	 *  <li>Throw null | undefined to indicate the 'next' handler in the chain should be called with no args.
	 * </ul>
	 */
	processApiResult<T>(req: Request, result: Promise<HttpResponse<T>> | null, res: Response, next: NextFunction) {
		if (typeof result === 'object' && (result instanceof Promise || typeof (result as any)?.then === 'function')) {
			return result.then(r => {
				if (r)
					return this.sendResponseAsync(req, r, res);
				// else, remember that undefined means it has been handled and we should do nothing.
			}).catch(err => {
				if (!err)
					next();
				else
					next(err);
			});
		}
		else {
			const rsp = {
				status: 501,
				data: undefined as T | undefined,
				headers: undefined as Record<string, string | string[]>
			};
			const desc = findDefaultStatusCodeMatch((req as any).openapi.schema.responses as any);
			if (desc) {
				const mockRsp = this.genMockResponse<T>(desc, req.url);
				if (typeof mockRsp.status === 'number')
					rsp.status = mockRsp.status;
				if (mockRsp.data)
					rsp.data = mockRsp.data;
				if (mockRsp.headers)
					rsp.headers = mockRsp.headers;
			}
			return this.sendResponseAsync(req, rsp, res);
		}
	}

	/**
	 * This can be an extension point for subclasses that effectively allows for async response handling.
	 */
	protected sendResponseAsync<T>(req: Request, oagRsp: HttpResponse<T>, expRes: Response<T>): Promise<Response<T>> {
		return Promise.resolve(this.sendResponseSync(req, oagRsp, expRes));
	}

	/**
	 * This can be a helper for subclasses to convert oag-tools HttpResponse to Express Response.
	 */
	protected sendResponseSync<T>(req: Request, oagRsp: HttpResponse<T>, expRes: Response<T>): Response<T> {
		if (oagRsp.headers && typeof oagRsp.headers === 'object')
			Object.keys(oagRsp.headers).forEach(name => {
				expRes.setHeader(name, oagRsp.headers[name]);
			});
		expRes.status(oagRsp.status ?? 200);
		if (typeof oagRsp.data === 'undefined')
			return expRes.send();
		else
			return expRes.send(oagRsp.data);
	}
}
