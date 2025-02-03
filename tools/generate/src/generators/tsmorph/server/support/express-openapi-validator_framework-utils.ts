import {NextFunction, Request, Response} from 'express';
import {mock} from 'mock-json-schema';
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
			rspSchema: obj['2XX'],
		};
	}
	// 3. check for the "default" response
	if ((obj as any).default) {
		return {
			status: 200,
			rspSchema: (obj as any).default,
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
 * Copied and abbreviated from openapi-backend.
 */
function exampleOrMock(content: Record<string, any>) {
	// resolve media type
	const mediaType = 'application/json';
	const mediaResponse = content[mediaType] || content[Object.keys(content)[0]];
	if (!mediaResponse)
		return undefined;
	const {examples, schema} = mediaResponse;
	// if operation has an example, return its value
	if (mediaResponse.example)
		return mediaResponse.example;
	// pick the first example from examples
	if (examples) {
		const exampleObject = examples[Object.keys(examples)[0]];
		return exampleObject.value;
	}
	// mock using json schema
	if (schema)
		return mock(schema);
	return undefined;
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
export function processApiResult<T>(req: Request, result: Promise<HttpResponse<T>> | null, res: Response, next: NextFunction) {
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
		if ((req as any)?.openapi?.schema?.responses) {
			const {status, rspSchema} = findDefaultStatusCodeMatch((req as any).openapi.schema.responses as object);
			if (typeof status === 'number')
				rspStatus = status;
			if (rspSchema)
				rspData = exampleOrMock(rspSchema.content);
		}
		return res.status(rspStatus).send(rspData as T);
	}
}
