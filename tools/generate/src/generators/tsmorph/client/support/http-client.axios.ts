// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection,ES6ShorthandObjectProperty

import axios, {AxiosRequestConfig} from 'axios';
/**
 * This module allows for the creation of an axios instance that conforms to the simplified @see HttpClient Api.
 */
import {HttpClient, HttpOptions, HttpResponse} from './http-client';

function AxiosHttpClientSubclass(): HttpClient & { ensureError(err: unknown): Error } {
	return {
		head(url: string, opts?: HttpOptions): Promise<HttpResponse<void>> {
			const aopts: AxiosRequestConfig = {
				...(opts ?? {}),
				withCredentials: opts?.credentials ? !!opts.credentials : undefined
			};
			delete (aopts as HttpOptions).credentials;
			return super.head(url, aopts).catch((e: any) => {
				throw this.ensureError(e);
			});
		},
		get<T = any>(url: string, opts?: HttpOptions): Promise<HttpResponse<T>> {
			const aopts: AxiosRequestConfig = {
				...(opts ?? {}),
				withCredentials: opts?.credentials ? !!opts.credentials : undefined
			};
			delete (aopts as HttpOptions).credentials;
			return super.get(url, aopts).catch((e: any) => {
				throw this.ensureError(e);
			});
		},
		post<T = any>(url: string, body?: any, opts?: HttpOptions): Promise<HttpResponse<T>> {
			const aopts: AxiosRequestConfig = {
				...(opts ?? {}),
				withCredentials: opts?.credentials ? !!opts.credentials : undefined
			};
			delete (aopts as HttpOptions).credentials;
			return super.post(url, body, aopts).catch((e: any) => {
				throw this.ensureError(e);
			});
		},
		put<T = any>(url: string, body?: any, opts?: HttpOptions): Promise<HttpResponse<T>> {
			const aopts: AxiosRequestConfig = {
				...(opts ?? {}),
				withCredentials: opts?.credentials ? !!opts.credentials : undefined
			};
			delete (aopts as HttpOptions).credentials;
			return super.put(url, body, opts).catch((e: any) => {
				throw this.ensureError(e);
			});
		},
		patch<T = any>(url: string, body?: any, opts?: HttpOptions): Promise<HttpResponse<T>> {
			const aopts: AxiosRequestConfig = {
				...(opts ?? {}),
				withCredentials: opts?.credentials ? !!opts.credentials : undefined
			};
			delete (aopts as HttpOptions).credentials;
			return super.patch(url, body, aopts).catch((e: any) => {
				throw this.ensureError(e);
			});
		},
		delete<T = any>(url: string, opts?: HttpOptions): Promise<HttpResponse<T>> {
			const aopts: AxiosRequestConfig = {
				...(opts ?? {}),
				withCredentials: opts?.credentials ? !!opts.credentials : undefined
			};
			delete (aopts as HttpOptions).credentials;
			return super.delete(url, aopts).catch((e: any) => {
				throw this.ensureError(e);
			});
		},

		ensureError(err: unknown): Error {
			if (!(typeof err === 'object' && err !== null && 'message' in err && typeof (err as Record<string, unknown>).message === 'string')) {
				try {
					return new Error(JSON.stringify(err));
				}
				catch {
					// fallback in case there's an error (perhaps with circular references for example).
					return new Error(String(err));
				}
			}
			return err as Error;
		}
	};
}

/**
 * Factory for actually constructing @see AxiosHttpClientSubclass
 */
export function makeAxiosHttpClient(config?: AxiosRequestConfig): HttpClient {
	const a = axios.create(config);
	// This makes our @see AxiosHttpClientSubclass a "subclass" of the axios instance so that we can call things like "super.post" to invoke the axios "base" method.
	return Object.setPrototypeOf(AxiosHttpClientSubclass(), a);
}
