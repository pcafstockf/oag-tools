/**
 * Generic Http Response structure.
 */
export interface HttpResponse<T = string | ArrayBuffer | object | number | boolean | null | void | undefined> {
	readonly status?: number;
	readonly headers?: Record<string, string | string[]>;
	readonly data?: T;
}
