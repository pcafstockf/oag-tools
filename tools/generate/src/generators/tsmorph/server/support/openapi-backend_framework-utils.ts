/**
 * Common functionality for OpenAPI endpoint handlers.
 * Please read the <b>critical</b> documentation for {@link AbsHandler#processResult}
 */
import {NextFunction, Response} from 'express';
import {Context} from 'openapi-backend';
import {HttpResponse} from './http-response';

/**
 * Handlers call an appropriate Api/Service method, and this method processes those responses. <br/>
 * Every Api/Service method is passed a 'ctx' object of openapi-backend type <a href="https://openapistack.co/docs/openapi-backend/api/#context-object">Context</a>.
 * <br/>
 * Every Api/Service method should:<ul>
 *  <li>Return Promise<{@link HttpResponse}> to send back the response.
 *  <li>Return Promise<null> to signify that the method has fully handled the response and no further action is needed.
 *  <li>Return null to indicate a mock response should be provided using <a href="https://openapistack.co/docs/openapi-backend/api/#mockresponseforoperationoperationid-opts">openapi-backend mocking</a>.
 *  <li>Throw an Error (or 'route' / 'router') to indicate the 'next' handler in the chain should be called with that "error".
 *  <li>Throw null | undefined to indicate the 'next' handler in the chain should be called with no args.
 * </ul>
 */
export function processApiResult<T>(ctx: Context, result: Promise<HttpResponse<T>> | null, res: Response, next: NextFunction) {
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
			// else, remember that undefined means its been handled and we should do nothing.
		}).catch(err => {
			if (!err)
				next();
			else
				next(err);
		});
	}
	else {
		const {status, mock} = ctx.api.mockResponseForOperation(ctx.operation.operationId, result || {});
		return res.status(status).send(mock as T);
	}
}
