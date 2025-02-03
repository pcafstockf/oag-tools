import {FastifyReply, FastifyRequest} from 'fastify';
import {mock} from 'mock-json-schema';
import {HttpResponse} from './http-response';

/**
 * Every Api/Service method receives this as its first parameter.
 */
export interface Context {
	request: FastifyRequest;
	response: FastifyReply;
}

/**
 * This is directly lifted out of the most excellent openapi-backend package (which FYI, also has Fastify support).
 * In fact the whole idea of returning a mock based on the response schema (using mock-json-schema), comes from openapi-backend.
 */
function findDefaultStatusCodeMatch(obj: Record<string | number, any>) {
	// 1. check for a 20X response
	for (const ok of [200, 201, 202, 203, 204]) {
		if (obj[ok]) {
			return {
				status: ok,
				rspSchema: obj[ok],
			};
		}
	}
	// 2. check for a 2XX response
	if (obj['2XX']) {
		return {
			status: 200,
			rspSchema: (obj as any)['2XX'],
		};
	}
	// 3. check for the "default" response
	if (obj.default) {
		return {
			status: 200,
			rspSchema: obj.default,
		};
	}
	// 4. pick first response code in list
	const code = Object.keys(obj)[0];
	return {
		status: Number(code),
		rspSchema: obj[code],
	};
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
export function processApiResult<T>(req: FastifyRequest, result: Promise<HttpResponse<T>> | null, res: FastifyReply) {
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
		if (req.routeOptions.schema.response) {
			const {status, rspSchema} = findDefaultStatusCodeMatch(req.routeOptions.schema.response as object);
			if (typeof status === 'number')
				rspStatus = status;
			if (rspSchema)
				rspData = mock(rspSchema);
		}
		res.status(rspStatus);
		if (rspData)
			return res.send(rspData);
		return res.send();
	}
}
