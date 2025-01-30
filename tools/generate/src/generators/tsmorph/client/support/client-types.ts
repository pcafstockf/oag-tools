import {ParamSerializers} from './param-serializers';

/**
 * Fingerprint of a remote operation call passed to the configuration callbacks.
 */
export interface OperationDesc {
	/**
	 * Operation id as defined in the OpenApi specification document.
	 */
	id: string;
	/**
	 * OpenApi operation pattern (e.g. /pet/{petId}).
	 */
	pattern: string;
	/**
	 * OpenApi operation method (get, post, put, etc.).
	 */
	method: string;
}

export type ParamSerializersType = typeof ParamSerializers;

export type BodySerializerFn = (op: OperationDesc, urlPath: string, mediaType: string, body: any, hdrs: Record<string, string>) => any;
