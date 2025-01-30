import {OperationDesc} from './client-types';

/**
 * Browser compatible fetch implementations handle a lot of types:
 *  https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#body
 * So, this method converts application/json from object to string, but otherwise just returns the existing body.
 */
export function specCompliantFetchBodySerializer(op: OperationDesc, urlPath: string, mediaType: string, body: any, hdrs: Record<string, string>) {
	if (mediaType.toLowerCase() === 'application/json' && typeof body === 'object' && body) {
		hdrs['content-type'] = mediaType;
		return JSON.stringify(body);
	}
	return body;
}
