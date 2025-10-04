import {NextFunction, Request, Response} from 'express';
import {DefaultMockDataGenerator, findDefaultStatusCodeMatch} from './data-mocking';
import {HttpResponse} from './http-response';

/**
 * Every Api/Service method receives this as its first parameter.
 */
export interface Context {
	openapiVersion: string;
	request: Request;
	response: Response;
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
			result.then(r => {
				if (r) {
					if (r.headers && typeof r.headers === 'object')
						Object.keys(r.headers).forEach(name => {
							res.setHeader(name, r.headers[name]);
						});
					res.status(r.status ?? 200);
					if (typeof r.data === 'undefined')
						return res.send();
					else
						return res.send(r.data);
				}
				// else, remember that undefined means it has been handled and we should do nothing.
			}).catch(err => {
				if (!err)
					next();
				else
					next(err);
			});
		}
		else {
			let rspStatus = 501;
			let rspData = undefined;
			const desc = findDefaultStatusCodeMatch((req as any).openapi.schema.responses as any);
			if (desc) {
				const mockRsp = this.genMockResponse(desc, req.url);
				if (typeof mockRsp?.status === 'number')
					rspStatus = mockRsp.status;
				if (mockRsp.data)
					rspData = mockRsp.data;
				if (mockRsp.headers)
					res = res.setHeaders(mockRsp.headers as any);
			}
			res = res.status(rspStatus);
			return res.send(rspData);
		}
	}
}
