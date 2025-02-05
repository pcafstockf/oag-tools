// noinspection HttpUrlsUsage

import FormData from 'form-data';
import assert from 'node:assert';
import * as http from 'node:http';
import * as https from 'node:https';
import {beforeEach, describe, it} from 'node:test';
import * as util from 'node:util';
import {gunzip, gzip} from 'zlib';
import {HttpClient, HttpResponse} from './http-client';
import {makeNodeHttpClient} from './http-client.node';

const asyncGzip = util.promisify(gzip);
const asyncGunzip = util.promisify(gunzip);

/**
 * Runs http tests against http://httpbin.org
 *  Described here: https://stackoverflow.com/questions/5725430/http-test-server-accepting-get-post-requests
 */
describe('Http Client', () => {
	let client: HttpClient;

	beforeEach(async () => {
		client = makeNodeHttpClient({
			agent: new http.Agent()
		});
	});
	it('head w/ 200', async () => {
		const url = 'http://httpbin.org/ip';
		const rsp = await client.head(url);
		assert.strictEqual(rsp.status, 200);
		assert.strictEqual(rsp.headers!['content-type'], 'application/json');
		assert(parseInt(rsp.headers!['content-length'] as string, 10) > 15);    // The get response for the url would be {"origin": "x.x.x.x"}
		assert((!(rsp as any).data) || Object.keys((rsp as any).data).length === 0);
	});
	it('get w/ 200', async () => {
		const url = 'http://httpbin.org/get';
		const rsp = await client.get(url, {
			headers: {'accept': 'application/json'}
		});
		assert.strictEqual(rsp.status, 200);
		assert.strictEqual(rsp.headers!['content-type'], 'application/json');
		assert(rsp.data);
		assert(rsp.data.headers.Accept.indexOf('application/json') >= 0); // Test what we *requested (what comes back from this url is always json).
		assert.strictEqual(rsp.data.url, url);
	});
	it('post w/ 200', async () => {
		const url = 'http://httpbin.org/post';
		let fd = new FormData({writable: true});
		fd.append('greeting', '42');
		const rsp = await client.post(url, fd);
		assert.strictEqual(rsp.status, 200);
		assert.strictEqual(rsp.headers!['content-type'], 'application/json');
		assert(rsp.data);
		assert.deepStrictEqual(rsp.data.form, {greeting: '42'});
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
		assert.strictEqual(rsp.status, 200);
		assert.strictEqual(rsp.headers!['content-type'], 'application/json');
		assert(rsp.data);
		assert.strictEqual(rsp.data.headers['Content-Type'], 'text/plain');
		assert.strictEqual(rsp.data.headers['Content-Encoding'], 'gzip');
		// The rest is an elaborate effort to ensure that we sent the server a properly encoded message.
		assert(rsp.data.data.startsWith('data:application/octet-stream'));
		let m = /data:(.+?)(;(base64))?,(.+)$/i.exec(rsp.data.data);
		assert(m);
		assert.strictEqual(m![1], 'application/octet-stream');
		assert.strictEqual(m![3], 'base64');
		let bin = Buffer.from(m![4], 'base64');
		let txt = await asyncGunzip(bin);
		assert.strictEqual(txt.toString('utf8'), content);
	});
	it('put text w/ 200', async () => {
		const url = 'http://httpbin.org/put';
		const rsp = await client.put(url, 'Greetings!', {
			headers: {
				'content-type': 'text/plain',
				'accept': 'text/*'
			}
		});
		assert.strictEqual(rsp.status, 200);
		assert.strictEqual(rsp.headers!['content-type'], 'application/json');
		assert(rsp.data);
		assert(rsp.data.headers.Accept.indexOf('text/*') >= 0);   // Test what we *requested (what comes back from this url is always json).
		assert(rsp.data.headers['Content-Type'].indexOf('text/plain') >= 0);   // Test what we *requested (what comes back from this url is always json).
		assert.strictEqual(rsp.data.data, 'Greetings!');
	});
	it('put obj as json w/ 200', async () => {
		const url = 'http://httpbin.org/put';
		const rsp = await client.put(url, {'a': {'b': 42}}, {
			headers: {
				'accept': 'application/json'
			}
		});
		assert.strictEqual(rsp.status, 200);
		assert.strictEqual(rsp.headers!['content-type'], 'application/json');
		assert(rsp.data);
		assert.strictEqual(rsp.data.json.a.b, 42);
	});
	it('patch w/ 200', async () => {
		const url = 'http://httpbin.org/patch';
		const rsp = await client.patch(url, {'a': {'b': 42}}, {
			headers: {
				'accept': 'application/json'
			}
		});
		assert.strictEqual(rsp.status, 200);
		assert.strictEqual(rsp.headers!['content-type'], 'application/json');
		assert(rsp.data);
		assert(rsp.data.headers.Accept.indexOf('application/json') >= 0); // Test what we *requested (what comes back from this url is always json).
		assert.strictEqual(rsp.data.url, url);
		assert.strictEqual(rsp.data.json.a.b, 42);
	});
	it('delete w/ 200', async () => {
		const url = 'http://httpbin.org/delete';
		const rsp = await client.delete(url);
		assert.strictEqual(rsp.status, 200);
	});
	it('can follow redirects', {skip: true}, async () => {
		const url = 'http://httpbin.org/redirect/2';
		const rsp = await client.get(url, {
			headers: {
				'accept': 'application/json'
			}
		});
		assert.strictEqual(rsp.status, 200);
		assert.strictEqual(rsp.data.url, 'http://httpbin.org/get'); // It redirects to its main url
	});
	it('can decode binary data', async () => {
		const url = 'http://httpbin.org/gzip';
		const rsp = await client.get(url);
		assert.strictEqual(rsp.status, 200);
		assert(rsp.data.gzipped); // The URL promises to deliver gzip content, so if we can decode this into a json string, then given that the content-encoding check above was gzip, then we know we decoded the compressed data correctly.
	});
	it('can handle http error status codes', async () => {
		const url = 'http://httpbin.org/hidden-basic-auth/foo/bar';
		try {
			await client.get(url);
			assert.fail('HttpClient did not throw on >= 400');
		}
		catch (e) {
			assert(e instanceof Error);
			assert.strictEqual((e as unknown as HttpResponse).status, 404);
		}
	});
	it('can make https requests', async () => {
		client = makeNodeHttpClient({
			agent: new https.Agent()
		});
		const url = 'https://www.amerisave.com';
		const rsp = await client.get(url);
		assert.strictEqual(rsp.status, 200);
	});
});
