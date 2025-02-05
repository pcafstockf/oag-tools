/**
 * NOTE: This implementation is typically less preferable than the fetch implementation which can be used on both browser and node.
 */
import {ClientRequest} from 'http';
import constants from 'node:constants';
import * as http from 'node:http';
import * as querystring from 'node:querystring';
import * as util from 'node:util';
import {brotliDecompress, gunzip, inflate} from 'node:zlib';
import {HttpClient, HttpOptions, HttpResponse} from './http-client';

const httpContentParsers = [
	['application/json', (data: string | Buffer, p?: Record<string, string>) => JSON.parse(Buffer.isBuffer(data) ? data.toString(p?.['charset'] as BufferEncoding ?? 'utf-8') : data)],
	['text/csv', (txt: string) => txt.split(/\r?\n/).map(row => row.split(','))],
	['application/x-www-form-urlencoded', (txt: string) => querystring.parse(txt)],
	[/text\/.+/, (txt: string) => txt],
];
const DefaultHttpContentOpts = {
	decoders: {
		gzip: util.promisify(gunzip),
		deflate: util.promisify(inflate),
		br: util.promisify(brotliDecompress)
	} as Record<string, (a: any) => Promise<any>>,
	parsers: new Map<string | RegExp, (t: any, p?: Record<string, string>) => any>(httpContentParsers as any)
};
export type HttpContentOptsType = typeof DefaultHttpContentOpts;

export async function processHttpContent(opts: HttpContentOptsType, data: Buffer | string | undefined, headers: http.IncomingHttpHeaders) {
	let payload = data;
	if (typeof payload !== 'undefined') {
		if (Buffer.isBuffer(payload)) {
			const decoder = opts.decoders[headers['content-encoding']];
			if (typeof decoder === 'function')
				payload = await decoder(payload);
			if (headers['content-transfer-encoding'] === 'base64')
				payload = payload.toString('utf-8');
		}
		if (headers['content-transfer-encoding'] === 'base64')
			payload = Buffer.from(payload as string, 'base64');
		let ct = headers['content-type'];
		if (ct) {
			let params: Record<string, string>;
			let semi = ct.indexOf(';');
			if (semi > 0) {
				params = ct.substring(semi + 1).split(';').map(p => p.trim().split('=')).reduce((r, a) => {
					(r as any)[a[0].trim()] = a[1].trim();
					return r;
				}, {});
				ct = ct.substring(0, semi);
			}
			let parser = opts.parsers.get(ct);
			if (!parser) {
				const key = Array.from(opts.parsers.keys()).filter(key => key instanceof RegExp).find((key: RegExp) => key.test(ct));
				if (key)
					parser = opts.parsers.get(key);
			}
			if (parser)
				payload = parser(payload, params);
		}
	}
	return payload;
}

type Writeable<T> = { -readonly [P in keyof T]: T[P] };

export type HttpClientOptsType = HttpContentOptsType & { agent: http.Agent };

export class NodeHttpClient implements HttpClient {
	constructor(protected clientOpts: HttpClientOptsType) {
	}

	protected handleAsyncResponse<T>(res: http.IncomingMessage, resolve: (value: HttpResponse<T>) => void, reject: (reason?: any) => void) {
		let data: Buffer[] | string[];
		res.on('error', e => {
			data = null;
			reject(e);
		});
		res.on('data', (chunk) => {
			if (data)
				data.push(chunk);
			else
				data = [chunk];
		});
		res.on('end', () => {
			if (!res.complete) {
				const err: NodeJS.ErrnoException = new Error('Connection reset by peer');
				err.errno = constants.ECONNRESET;
				err.code = 'ECONNRESET';
				reject(err);
				return;
			}
			if (data === null)  // Error was already thrown.
				return;
			let rsp: Partial<Writeable<HttpResponse<string | Buffer>>> = {
				status: res.statusCode,
				headers: res.headers
			};
			if (data?.length > 0) {
				let payload: Buffer | string;
				if (Buffer.isBuffer(data[0]))
					payload = Buffer.concat(data as Buffer[]);
				else
					payload = (data as string[]).join();
				processHttpContent(this.clientOpts, payload, res.headers).then(d => {
					rsp.data = d;
					resolve(rsp as HttpResponse<T>);
				}).catch(e => reject(e));
			}
			else if (rsp.status < 399)
				resolve(rsp as HttpResponse<T>);
			else {
				const err: NodeJS.ErrnoException = new Error(res.statusMessage);
				err.errno = res.statusCode;
				err.code = res.statusMessage;
				Object.assign(err, <HttpResponse>{
					status: res.statusCode
				});
				reject(err);
			}
		});
	}

	protected writeRequestBody(req: ClientRequest, body: any): void {
		if (typeof body.pipe === 'function') {
			body.pipe(req);
			return;
		}
		if (Buffer.isBuffer(body) || typeof body === 'string') {
			req.write(body);
			return;
		}
		if (typeof body === 'object' && body) {
			req.write(JSON.stringify(body));
			return;
		}
		req.write(body);
	}

	head(url: string, opts?: HttpOptions): Promise<HttpResponse<void>> {
		return new Promise<HttpResponse<void>>((resolve, reject) => {
			const ro = {
				method: 'HEAD',
				headers: opts?.headers ?? undefined,
				agent: this.clientOpts.agent
			};
			const req = http.request(url, ro, res => this.handleAsyncResponse<void>(res, resolve, reject));
			req.on('error', e => {
				reject(e);
			});
			req.end();
		});
	}

	get<T = any>(url: string, opts?: HttpOptions): Promise<HttpResponse<T>> {
		return new Promise<HttpResponse<T>>((resolve, reject) => {
			const ro = {
				method: 'GET',
				headers: opts?.headers ?? undefined,
				agent: this.clientOpts.agent
			};
			const req = http.request(url, ro, res => this.handleAsyncResponse<T>(res, resolve, reject));
			req.on('error', e => {
				reject(e);
			});
			req.end();
		});
	}

	post<T = any>(url: string, body?: any, opts?: HttpOptions): Promise<HttpResponse<T>> {
		return new Promise<HttpResponse<T>>((resolve, reject) => {
			const ro = {
				method: 'POST',
				headers: opts?.headers ?? undefined,
				agent: this.clientOpts.agent
			};
			if (typeof body.getHeaders === 'function')
				ro.headers = Object.assign(ro.headers ?? {}, body.getHeaders());
			const req = http.request(url, ro, res => this.handleAsyncResponse<T>(res, resolve, reject));
			req.on('error', e => {
				reject(e);
			});
			if (body)
				this.writeRequestBody(req, body);
			req.end();
		});
	}

	put<T = any>(url: string, body?: any, opts?: HttpOptions): Promise<HttpResponse<T>> {
		return new Promise<HttpResponse<T>>((resolve, reject) => {
			const ro = {
				method: 'PUT',
				headers: opts?.headers ?? undefined,
				agent: this.clientOpts.agent
			};
			if (typeof body.getHeaders === 'function')
				ro.headers = Object.assign(ro.headers ?? {}, body.getHeaders());
			const req = http.request(url, ro, res => this.handleAsyncResponse<T>(res, resolve, reject));
			req.on('error', e => {
				reject(e);
			});
			if (body)
				this.writeRequestBody(req, body);
			req.end();
		});
	}

	patch<T = any>(url: string, body?: any, opts?: HttpOptions): Promise<HttpResponse<T>> {
		return new Promise<HttpResponse<T>>((resolve, reject) => {
			const ro = {
				method: 'PATCH',
				headers: opts?.headers ?? undefined,
				agent: this.clientOpts.agent
			};
			if (typeof body.getHeaders === 'function')
				ro.headers = Object.assign(ro.headers ?? {}, body.getHeaders());
			const req = http.request(url, ro, res => this.handleAsyncResponse<T>(res, resolve, reject));
			req.on('error', e => {
				reject(e);
			});
			if (body)
				this.writeRequestBody(req, body);
			req.end();
		});
	}

	delete<T = any>(url: string, opts?: HttpOptions): Promise<HttpResponse<T>> {
		return new Promise<HttpResponse<T>>((resolve, reject) => {
			const ro = {
				method: 'DELETE',
				headers: opts?.headers ?? undefined,
				agent: this.clientOpts.agent
			};
			const req = http.request(url, ro, res => this.handleAsyncResponse<T>(res, resolve, reject));
			req.on('error', e => {
				reject(e);
			});
			req.end();
		});
	}
}

export function makeNodeHttpClient(opts?: Partial<HttpClientOptsType>): HttpClient {
	// We do not want to allow alterations of either the opts the caller provided, nor our own default opts.
	let o = {
		...(opts ?? {} as HttpClientOptsType),
		// These will overwrite the opts the caller passed us (which we want to do here).
		decoders: Object.assign(DefaultHttpContentOpts.decoders),
		parsers: new Map<string | RegExp, (a: any) => any>()
	} as HttpClientOptsType;
	for (const [key, value] of DefaultHttpContentOpts.parsers)
		o.parsers.set(key, value);
	// 'o' now contains any 'opts' the caller provided, plus the default HttpContentOpts
	if (opts) {
		// Overwrite/add any decoders the caller provided
		Object.assign(o.decoders, opts.decoders ?? {});
		// Overwrite/add any parsers the caller provided
		if (opts.parsers instanceof Map)
			for (const [key, value] of opts.parsers)
				o.parsers.set(key, value);
	}
	return new NodeHttpClient(o);
}
