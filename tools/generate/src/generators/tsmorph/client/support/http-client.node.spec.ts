// noinspection HttpUrlsUsage

import FormData from 'form-data';
import * as http from 'http';
import * as https from 'https';
import * as util from 'util';
import {gunzip, gzip} from 'zlib';
import {HttpClient} from './http-client';
import {makeNodeHttpClient} from './http-client.node';

const asyncGzip = util.promisify(gzip);
const asyncGunzip = util.promisify(gunzip);

/**
 * Runs http tests against http://httpbin.org
 *  Described here: https://stackoverflow.com/questions/5725430/http-test-server-accepting-get-post-requests
 */
describe('Http Client', () => {
	const originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
	let client: HttpClient;

	beforeAll(() => {
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 60000;
	});
	afterAll(async () => {
		jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
	});
	beforeEach(async () => {
		client = makeNodeHttpClient({
			agent: new http.Agent()
		});
	});
	it('head w/ 200', async () => {
		const url = 'http://httpbin.org/ip';
		const rsp = await client.head(url);
		expect(rsp.status).toEqual(200);
		expect(rsp.headers!['content-type']).toEqual('application/json');
		expect(parseInt(rsp.headers!['content-length'] as string, 10)).toBeGreaterThan(15);    // The get response for the url would be {"origin": "x.x.x.x"}
		expect((!(rsp as any).data) || Object.keys((rsp as any).data).length === 0).toBe(true);
	});
	it('get w/ 200', async () => {
		const url = 'http://httpbin.org/get';
		const rsp = await client.get(url, {
			headers: {'accept': 'application/json'}
		});
		expect(rsp.status).toEqual(200);
		expect(rsp.headers!['content-type']).toEqual('application/json');
		expect(rsp.data).toBeTruthy();
		expect(rsp.data.headers.Accept).toContain('application/json'); // Test what we *requested (what comes back from this url is always json).
		expect(rsp.data.url).toEqual(url);
	});
	it('post w/ 200', async () => {
		const url = 'http://httpbin.org/post';
		let fd = new FormData({writable: true});
		fd.append('greeting', '42');
		const rsp = await client.post(url, fd);
		expect(rsp.status).toEqual(200);
		expect(rsp.headers!['content-type']).toEqual('application/json');
		expect(rsp.data).toBeTruthy();
		expect(rsp.data.form).toEqual({greeting: '42'});
	});
	it('post binary compressed data w/ 200', async () => {
		const url = 'http://httpbin.org/post';
		const content = 'Hi Buff!';
		const buf = await asyncGzip(content);
		// Use Content-Encoding instead of Transfer-Encoding because we *need* the data to arrive at the server in gzipped format.
		const rsp = await client.post(url, buf, {
			headers: {
				'accept': 'application/json',
				'Content-Type': 'text/plain',
				'Content-Encoding': 'gzip'
			}
		});
		expect(rsp.status).toEqual(200);
		expect(rsp.headers!['content-type']).toEqual('application/json');
		expect(rsp.data).toBeTruthy();
		expect(rsp.data.headers['Content-Type']).toEqual('text/plain');
		expect(rsp.data.headers['Content-Encoding']).toEqual('gzip');
		// The rest is an elaborate effort to ensure that we sent the server a properly encoded message.
		expect(rsp.data.data.startsWith('data:application/octet-stream')).toBe(true);
		let m = /data:(.+?)(;(base64))?,(.+)$/i.exec(rsp.data.data);
		expect(m).toBeTruthy();
		expect(m![1]).toEqual('application/octet-stream');
		expect(m![3]).toEqual('base64');
		let bin = Buffer.from(m![4], 'base64');
		let txt = await asyncGunzip(bin);
		expect(txt.toString('utf8')).toEqual(content);
	});
	it('put text w/ 200', async () => {
		const url = 'http://httpbin.org/put';
		const rsp = await client.put(url, 'Greetings!', {
			headers: {
				'content-type': 'text/plain',
				'accept': 'text/*'
			}
		});
		expect(rsp.status).toEqual(200);
		expect(rsp.headers!['content-type']).toEqual('application/json');
		expect(rsp.data).toBeTruthy();
		expect(rsp.data.headers.Accept).toContain('text/*');   // Test what we *requested (what comes back from this url is always json).
		expect(rsp.data.headers['Content-Type']).toContain('text/plain');   // Test what we *requested (what comes back from this url is always json).
		expect(rsp.data.data).toEqual('Greetings!');
	});
	it('put obj as json w/ 200', async () => {
		const url = 'http://httpbin.org/put';
		const rsp = await client.put(url, {'a': {'b': 42}}, {
			headers: {
				'accept': 'application/json'
			}
		});
		expect(rsp.status).toEqual(200);
		expect(rsp.headers!['content-type']).toEqual('application/json');
		expect(rsp.data).toBeTruthy();
		expect(rsp.data.json.a.b).toEqual(42);
	});
	it('patch w/ 200', async () => {
		const url = 'http://httpbin.org/patch';
		const rsp = await client.patch(url, {'a': {'b': 42}}, {
			headers: {
				'accept': 'application/json'
			}
		});
		expect(rsp.status).toEqual(200);
		expect(rsp.headers!['content-type']).toEqual('application/json');
		expect(rsp.data).toBeTruthy();
		expect(rsp.data.headers.Accept).toContain('application/json'); // Test what we *requested (what comes back from this url is always json).
		expect(rsp.data.url).toEqual(url);
		expect(rsp.data.json.a.b).toEqual(42);
	});
	it('delete w/ 200', async () => {
		const url = 'http://httpbin.org/delete';
		const rsp = await client.delete(url);
		expect(rsp.status).toEqual(200);
	});
	xit('can follow redirects', async () => {
		const url = 'http://httpbin.org/redirect/2';
		const rsp = await client.get(url, {
			headers: {
				'accept': 'application/json'
			}
		});
		expect(rsp.status).toEqual(200);
		expect(rsp.data.url).toEqual('http://httpbin.org/get'); // It redirects to its main url
	});
	it('can decode binary data', async () => {
		const url = 'http://httpbin.org/gzip';
		const rsp = await client.get(url);
		expect(rsp.status).toEqual(200);
		expect(rsp.data.gzipped).toBeTrue(); // The URL promises to deliver gzip content, so if we can decode this into a json string, then given that the content-encoding check above was gzip, then we know we decoded the compressed data correctly.
	});
	it('can handle http error status codes', async () => {
		const url = 'http://httpbin.org/hidden-basic-auth/foo/bar';
		try {
			await client.get(url);
			fail('HttpClient did not throw on >= 400');
		}
		catch (e) {
			expect(e).toBeInstanceOf(Error);
			// expect((e as NodeJS.ErrnoException).errno).toEqual(404);
		}
	});
	it('can make https requests', async () => {
		client = makeNodeHttpClient({
			agent: new https.Agent()
		});
		const url = 'https://www.amerisave.com';
		const rsp = await client.get(url);
		expect(rsp.status).toEqual(200);
	});
});
