import {merge} from 'lodash';
import {OpenAPIV3_1} from 'openapi-types';

// Ideally applications use type-fest, but don't create a dependency if they don't.
export type DeepPartial<T> = T extends object ? {
	[P in keyof T]?: DeepPartial<T[P]>;
} : T;

/**
 * Dynamically generated response used by client or server mocking.
 */
export interface MockedResponse<T> {
	readonly status?: number;
	readonly headers?: Record<string, string | string[]>;
	readonly data?: T;
}

/**
 * A description / template / pattern that can be used to dynamically construct a @see MockedResponse.
 */
export interface MockResponseDescription extends Omit<OpenAPIV3_1.MediaTypeObject, 'schema'> {
	status?: number;
	schema?: OpenAPIV3_1.SchemaObject | ({ type: string; [key: string | number]: any });
}

/**
 * Use a json schema as input, to produce a conforming json object as output.
 */
export interface MockDataGenerator {
	/**
	 * Generates a json object conforming to the supplied jsons schema, and then optionally deep merges overridable properties.
	 */
	genMockData<T>(schema: { type: string; [key: string | number]: any }, overrides?: DeepPartial<T>): T;

	/**
	 * Uses a static @see MockResponseDescription to produce a dynamic @see MockedResponse.
	 */
	genMockResponse<T>(mt: MockResponseDescription, urlPath?: string): MockedResponse<T>;
}

/**
 * @inheritDoc
 * Default implementation.
 * Can/should be configured with a function that can take a json schema as input, and return a conforming json object as output.
 * Can also be configured to prefer (or ignore) examples described in an OpenApi MediaTypeObject, over dynamically generating mock data.
 */
export class DefaultMockDataGenerator implements MockDataGenerator {
	constructor(protected mockGenFn?: (s: { type: string }) => any, protected preferExamples?: boolean) {
	}

	/**
	 * @inheritDoc
	 */
	genMockData<T>(schema: { type: string }, overrides?: DeepPartial<T>): T {
		let retVal: T = undefined as T;
		if (typeof this.mockGenFn === 'function') {
			retVal = this.mockGenFn(schema) as T;
			if (overrides)
				retVal = merge(retVal, overrides);
		}
		return retVal;
	}

	/**
	 * @inheritDoc
	 */
	genMockResponse<T>(mt: MockResponseDescription, urlPath?: string): MockedResponse<T> {
		let data: T;
		// if operation has an example, return its value
		if (this.preferExamples) {
			if (mt.example)
				data = mt.example;
			// pick the first example from examples
			else if (mt.examples) {
				const exampleObject = mt.examples[Object.keys(mt.examples)[0]] as OpenAPIV3_1.ExampleObject;
				if (exampleObject)
					data = exampleObject.value;
			}
		}
		// Use the configured schema mocker.
		if (mt.schema && (!data))
			data = this.genMockData(mt.schema as any);
		return {
			status: mt.status,
			data: data
		};
	}
}

/**
 * This function examines an OpenApi responses collection, and uses heuristics to determine the most appropriate MediaTypeObject to be used for constructing mock response data.
 * This is inspired by the most excellent openapi-backend package.
 * In fact the whole idea of returning a mock based on the response schema (using mock-json-schema), comes from openapi-backend.
 * The client generator uses this function at code generation time to determine an appropriate @see MockResponseDescription for endpoint mocks.
 * The server generator uses this function at runtime as part of @see FrameworkUtils to produce mock responses for stubbed api responses.
 */
export function findDefaultStatusCodeMatch(obj: OpenAPIV3_1.ResponsesObject, mimeFilter?: (t: string) => boolean): MockResponseDescription | undefined {
	if (!mimeFilter)
		mimeFilter = (t) => t === 'application/json';
	const getMT = (rsp: OpenAPIV3_1.ResponseObject | undefined) => {
		if (!rsp)
			return undefined;
		const mts = Object.keys(rsp.content ?? {}).map(k => k.toLowerCase());
		return rsp.content?.[mts.find(mimeFilter)];
	};
	let mt: OpenAPIV3_1.MediaTypeObject;

	// 1. check for a 20X response
	for (const ok of [200, 201, 202, 203, 204, '200', '201', '202', '203', '204']) {
		mt = getMT(obj[ok] as OpenAPIV3_1.ResponseObject);
		if (mt) {
			return {
				...mt,
				status: Number(ok)
			};
		}
	}
	// 2. check for a 2XX response
	mt = getMT(obj['2XX'] as OpenAPIV3_1.ResponseObject);
	if (mt) {
		return {
			...mt,
			status: 200
		};
	}
	// 3. check for the "default" response
	mt = getMT(obj.default as OpenAPIV3_1.ResponseObject);
	if (mt) {
		return {
			...mt,
			status: 200
		};
	}
	// 4. pick first response code in list
	const code = Object.keys(obj)[0];
	mt = getMT(obj[code] as OpenAPIV3_1.ResponseObject);
	if (mt) {
		return {
			...mt,
			status: Number(code)
		};
	}
	return undefined;
}
