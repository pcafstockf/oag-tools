// noinspection JSUnusedGlobalSymbols

import {HttpClient as AHC, HttpResponse as AHR} from '@angular/common/http';
import {lastValueFrom, map, Observable} from 'rxjs';

/**
 * This module allows for the creation of an Angular HttpClient proxy that conforms to our simplified @see HttpClient Api.
 */
import {HttpClient, HttpOptions, HttpResponse} from './http-client';

class AngularHttpClient implements HttpClient {
	constructor(protected ahc: AHC) {
	}

	head(url: string, opts?: HttpOptions): Promise<HttpResponse<void>> {
		return this.toHttpResponsePromise<void>(this.ahc.head<void>(url, {
			headers: opts?.headers,
			observe: 'response',
			withCredentials: opts?.credentials ? !!opts.credentials : undefined
		}));
	}

	get<T = any>(url: string, opts?: HttpOptions): Promise<HttpResponse<T>> {
		return this.toHttpResponsePromise<T>(this.ahc.get<T>(url, {
			headers: opts?.headers,
			observe: 'response',
			responseType: this.computeResponseType(opts?.headers) as unknown as any,
			withCredentials: opts?.credentials ? !!opts.credentials : undefined
		}));
	}

	post<T = any>(url: string, body?: any, opts?: HttpOptions): Promise<HttpResponse<T>> {
		return this.toHttpResponsePromise<T>(this.ahc.post<T>(url, body, {
			headers: opts?.headers,
			observe: 'response',
			responseType: this.computeResponseType(opts?.headers) as unknown as any,
			withCredentials: opts?.credentials ? !!opts.credentials : undefined
		}));
	}

	put<T = any>(url: string, body?: any, opts?: HttpOptions): Promise<HttpResponse<T>> {
		return this.toHttpResponsePromise<T>(this.ahc.put<T>(url, body, {
			headers: opts?.headers,
			observe: 'response',
			responseType: this.computeResponseType(opts?.headers) as unknown as any,
			withCredentials: opts?.credentials ? !!opts.credentials : undefined
		}));
	}

	patch<T = any>(url: string, body?: any, opts?: HttpOptions): Promise<HttpResponse<T>> {
		return this.toHttpResponsePromise<T>(this.ahc.patch<T>(url, body, {
			headers: opts?.headers,
			observe: 'response',
			responseType: this.computeResponseType(opts?.headers) as unknown as any,
			withCredentials: opts?.credentials ? !!opts.credentials : undefined
		}));
	}

	delete<T = any>(url: string, opts?: HttpOptions): Promise<HttpResponse<T>> {
		return this.toHttpResponsePromise<T>(this.ahc.delete<T>(url, {
			headers: opts?.headers,
			observe: 'response',
			responseType: this.computeResponseType(opts?.headers) as unknown as any,
			withCredentials: opts?.credentials ? !!opts.credentials : undefined
		}));
	}

	protected toHttpResponsePromise<T>(o: Observable<AHR<T>>): Promise<HttpResponse<T>> {
		return lastValueFrom(o.pipe(map((r) => {
			return {
				status: r.status,
				headers: r.headers.keys().reduce((p, key) => {
					p[key] = r.headers.getAll(key);
					if (Array.isArray(p[key]) && p[key].length < 2)
						p[key] = p[key][0];
					return p;
				}, {} as Record<string, string | string[]>),
				data: r.body as T
			};
		})));
	}

	protected computeResponseType(headers?: Record<string, string | string[]>): 'arraybuffer' | 'blob' | 'json' | 'text' {
		let accept = headers?.accept;
		if (typeof accept === 'string')
			accept = [accept];
		return accept?.find(t => {
			switch (t) {
				case '*/*':
				case 'application/json':
					return 'json';
				case 'application/octet-stream':
					return 'arraybuffer';
				default:
					return /text\/.+/.test(t) ? 'text' : false;
			}
		}) as any ?? 'json';
	}
}

/**
 * Factory for actually constructing @see AngularHttpClient
 */
export function makeAngularHttpClient(ahc: AHC): AngularHttpClient {
	return new AngularHttpClient(ahc);
}
