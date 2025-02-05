/**
 * Generic Http Response structure.
 */
export interface HttpResponse<T = string | ArrayBuffer | object | number | boolean | null | void | undefined> {
	readonly status: number;
	readonly headers?: Record<string, string | string[]>;
	readonly data?: T;
}

/**
 * Generic Http Client Request Options.
 */
export interface HttpOptions {
	headers?: Record<string, string | string[]>;
	credentials?: string | boolean;
}

/**
 * This simplified HttpClient Api is all most services ever need, but should be invisibly *overloaded* on top of a more fully featured client (e.g. Axios).
 * You can then configure the underlying implementations default settings, and simply focus on http calls.
 * If you need something more complex, just cast the instance to the underlying client type.
 * NOTE:
 *  In the case of Http status codes > 299, these methods will throw an Error exception whose message is the statusTxt and which also conforms to @see HttpResponse.
 */
export interface HttpClient {
	head(url: string, opts?: HttpOptions): Promise<HttpResponse<void>>;

	get<T = any>(url: string, opts?: HttpOptions): Promise<HttpResponse<T>>;

	post<T = any>(url: string, body?: any, opts?: HttpOptions): Promise<HttpResponse<T>>;

	put<T = any>(url: string, body?: any, opts?: HttpOptions): Promise<HttpResponse<T>>;

	patch<T = any>(url: string, body?: any, opts?: HttpOptions): Promise<HttpResponse<T>>;

	delete<T = any>(url: string, opts?: HttpOptions): Promise<HttpResponse<T>>;
}
