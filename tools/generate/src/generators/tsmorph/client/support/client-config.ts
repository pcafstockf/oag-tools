import {RequestAuthFn, RequestEnhancerFn} from './client-request';
import {BodySerializerFn, ParamSerializersType} from './client-types';

export interface ApiClientConfig {
	/**
	 * This should be the full prefix (e.g. https://api.example.com/v1
	 */
	baseURL?: string;
	/**
	 * Invoked to serialize http request bodies.
	 * See docs/Request-Serialization.md for more info.
	 */
	bodySerializer?: BodySerializerFn;
	/**
	 * OpenAPI supports many parameter serialization mechanisms some of which are dependent on where the parameter is used (path, query, header, cookie).
	 * ./client-utils has a working implementation, but you may swap in your own.
	 * See docs/Request-Serialization.md for more info.
	 */
	paramSerializers?: ParamSerializersType;
	/**
	 * This is where you add custom headers and control cookie submission.
	 */
	enhanceReq?: RequestEnhancerFn;
	ensureAuth?: RequestAuthFn;
}
