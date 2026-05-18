### Setup for oag-tools generated Fastify server

The generated server code is designed to work with [fastify-openapi-glue](https://www.npmjs.com/package/fastify-openapi-glue) for request routing and validation against your OpenApi specification.

#### Getting started

1. **Create a dependency injection container** using `async-injection` and call the generated `setup()` function (in `services/setup.ts`) to register your service implementations.
2. **Create handler objects** using the generated `make*Handler()` functions (in `handlers/`). These bridge between fastify-openapi-glue routing and your service implementations. Pass a `FrameworkUtils` instance to enable mock data responses for unimplemented endpoints.
3. **Merge all handler objects** into a single operationId-keyed object (fastify-openapi-glue requires this).
4. **Configure AJV 2020** for JSON Schema draft 2020-12 validation (required for OpenApi v3.1 compatibility).
5. **Register fastify-openapi-glue** with your assembled OpenApi v3.1 bundle and the merged handler object.
6. **Optionally use `FrameworkUtils` helpers** — `GlueCookie()` adds cookie validation support (not natively supported by Fastify), and `GlueDefaultRspContent()` sets up default response content-type handling.

#### Key generated files

- `services/setup.ts` — Registers service implementations in the DI container
- `handlers/` — Framework-specific request handlers (one per API tag)
- `internal/framework-utils.ts` — Fastify-specific utilities including cookie validation and mock data
- `internal/data-mocking.ts` — Mock data generator using JSON Schema

#### Mock data

By default, any service method that returns `null` will trigger `FrameworkUtils` to respond with specification-conforming mock data. This means frontend development can begin immediately against a fully functional (mock) server.

## Example

A little server (using fastify-openapi-glue) is really just this simple.  
It will respond (with mock data) to every single endpoint defined in the specification.
(e.g. use oag-tools to generate, and your frontend development is no longer waiting on the backend).

```typescript
import 'reflect-metadata';
import {Container} from 'async-injection';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import fastify from 'fastify';
import {mock} from 'mock-json-schema';
import {OpenAPIV3_1} from 'openapi-types';
import jsonOsSpec from './petstore.bundle.json';
import {PetApiToken, StoreApiToken, UserApiToken} from './server/apis';
import {makePetHandlerHandler, makeStoreHandlerHandler, makeUserHandlerHandler} from './server/handlers';
import {FrameworkUtils} from './server/internal';
import {setup} from './server/services/setup';

(async () => {
	const fogPromise = import('fastify-openapi-glue');
	const oaSpec = {
		// When TypeScript/nodejs "imports" json, for some reason it loads top level arrays and objects as getters; Perform a spread operation to get a POJSO.
		...jsonOsSpec
	} as OpenAPIV3_1.Document;
	
	// Setup the Context Root.
	const container = new Container();
	setup(container);
	// FrameworkUtils provides fastify-openapi-glue utilities, as well as data response mocking services.
	const utils = new FrameworkUtils(mock as any, true);
	// fastify-openapi-glue requires all handlers to be registered inside a single operationId keyed object.
	let singularity = {};
	Object.assign(singularity, makePetHandlerHandler(utils, container.get(PetApiToken)));
	Object.assign(singularity, makeStoreHandlerHandler(utils, container.get(StoreApiToken)));
	Object.assign(singularity, makeUserHandlerHandler(utils, container.get(UserApiToken)));

	console.log('Gluing fastify...');
	const ajv = new Ajv2020({
		strict: false,
		coerceTypes: true
	});
	addFormats(ajv);
	ajv.addFormat('media-range', true);
	const app = fastify();
	// This sets fastify to use our AJV instance.
	app.setValidatorCompiler(({schema}) => {
		return ajv.compile(schema);
	});
	// fastify-openapi-glue + FrameworkUtils allow us to validate cookies in the specification (something Fastify does not normally support)
	FrameworkUtils.GlueCookie(app, ajv);
	FrameworkUtils.GlueDefaultRspContent(app, oaSpec);
	await app.register(await fogPromise, {
		specification: oaSpec,
		serviceHandlers: singularity
	});

	console.log('Starting...');
	const hostname = 'localhost';
	const port = 9000;
	app.listen({
		host: hostname,
		port: port
	}, (err: Error | null, address: string) => {
		if (err)
			throw err;
		console.log(`Listening @ ${address}`);
	});
})().catch(e => {
	console.error(e);
	process.exit(1);
});
```
