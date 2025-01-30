import {HttpClient, HttpOptions, HttpResponse} from './http-client';

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

class FetchHttpClient implements HttpClient {
	constructor() {
	}

	head(url: string, opts?: HttpOptions): Promise<HttpResponse<void>> {
		return this.sendRequest('HEAD', url, opts).then(r => this.processResponse<void>(r));
	}

	get<T = any>(url: string, opts?: HttpOptions): Promise<HttpResponse<T>> {
		return this.sendRequest('GET', url, opts).then(r => this.processResponse<T>(r));
	}

	post<T = any>(url: string, body?: any, opts?: HttpOptions): Promise<HttpResponse<T>> {
		return this.sendRequest('POST', url, opts, body).then(r => this.processResponse<T>(r));
	}

	put<T = any>(url: string, body?: any, opts?: HttpOptions): Promise<HttpResponse<T>> {
		return this.sendRequest('PUT', url, opts, body).then(r => this.processResponse<T>(r));
	}

	patch<T = any>(url: string, body?: any, opts?: HttpOptions): Promise<HttpResponse<T>> {
		return this.sendRequest('PATCH', url, opts, body).then(r => this.processResponse<T>(r));
	}

	delete<T = any>(url: string, opts?: HttpOptions): Promise<HttpResponse<T>> {
		return this.sendRequest('DELETE', url, opts).then(r => this.processResponse<T>(r));
	}

	protected sendRequest<T>(method: string, url: string, opts?: HttpOptions, body?: any) {
		const options: RequestInit = {
			method
		};
		if (typeof opts?.headers !== 'undefined')
			options.headers = Object.keys(opts.headers).reduce((acc, key) => {
				if (Array.isArray(opts.headers[key]))
					acc[key] = (opts.headers[key] as string[]).join(',');
				else
					acc[key] = opts.headers[key] as unknown as string;
				return acc;
			}, opts.headers as unknown as Record<string, string>);
		if (typeof body !== 'undefined')
			options.body = body;
		if (typeof opts?.credentials === 'boolean')
			options.credentials = opts?.credentials ? 'include' : 'omit';
		else if (typeof opts?.credentials === 'string')
			options.credentials = opts?.credentials as RequestCredentials;
		return fetch(url, options);
	}

	protected async processResponse<T>(rsp: Response) {
		const retVal: Writeable<HttpResponse<T>> = {
			status: rsp.status,
		};
		rsp.headers.forEach((v, k) => {
			if (!retVal.headers)
				retVal.headers = {};
			const lk = k.toLowerCase();
			let val = retVal.headers[lk];
			if (typeof val === 'string')
				val = [val];
			else if (Array.isArray(val))
				val.push(v);
			else
				val = v;
			retVal.headers[lk] = val;
		});
		if (rsp.ok) {
			let contentType = retVal.headers['content-type'] as string;
			if (contentType) {
				const semi = contentType.indexOf(';');
				if (semi > 0)   // We assume fetch.Response is intelligent enough to detect content-type params.
					contentType = contentType.substring(0, semi);
				switch (contentType) {
					case 'application/json':
					case 'application/ld+json':
						retVal.data = await rsp.json() as T;
						break;
					case 'multipart/form-data':
						retVal.data = await rsp.formData() as T;
						break;
					case 'application/x-www-form-urlencoded':
						const txt = await rsp.text();
						retVal.data = new URLSearchParams(txt) as T;
						break;
					default: {
						if (contentType.startsWith('application/')) {
							switch (contentType) {
								case 'application/xml':
								case 'application/xhtml+xml':
								case 'application/javascript':
									retVal.data = await rsp.text() as T;
									break;
								default:
									retVal.data = await rsp.blob() as T;
									break;
							}
						}
						else if (contentType.startsWith('text/'))
							retVal.data = await rsp.text() as T;
						else
							retVal.data = await rsp.blob() as T;
					}
				}
			}
			else
				retVal.data = await rsp.blob() as T;
		}
		return retVal;
	}
}

/**
 * Factory for actually constructing @see FetchHttpClient
 */
export function makeFetchHttpClient(): FetchHttpClient {
	return new FetchHttpClient();
}
