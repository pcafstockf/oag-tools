### Setup for oag-tools generated Express server

The generated server code is designed to work with [express-openapi-validator](https://www.npmjs.com/package/express-openapi-validator) for request/response validation against your OpenApi specification.

#### Getting started

1. **Create a dependency injection container** using `async-injection` and call the generated `setup()` function (in `services/setup.ts`) to register your service implementations.
2. **Create a handler object** using the generated `make*Handler()` functions (in `handlers/`). These bridge between the express-openapi-validator routing layer and your service implementations. Pass a `FrameworkUtils` instance to enable mock data responses for unimplemented endpoints.
3. **Configure express-openapi-validator** with your assembled OpenApi v3.1 bundle and register the handler objects.
4. **Start the Express server** as usual.

#### Key generated files

- `services/setup.ts` — Registers service implementations in the DI container
- `handlers/` — Framework-specific request handlers (one per API tag)
- `internal/framework-utils.ts` — Utilities for response handling and mock data generation
- `internal/data-mocking.ts` — Mock data generator using JSON Schema

#### Mock data

By default, any service method that returns `null` will trigger `FrameworkUtils` to respond with specification-conforming mock data. This means frontend development can begin immediately against a fully functional (mock) server.

## Example

A little server (using express-openapi-validator) is really just this simple.  
It will respond (with mock data) to every single endpoint defined in the specification.
(e.g. use oag-tools to generate, and your frontend development is no longer waiting on the backend).

```typescript
import 'reflect-metadata';
import {Container} from 'async-injection';
import {OpenAPIV3_1} from 'openapi-types';
import express from 'express';
import * as OpenApiValidator from 'express-openapi-validator';
import {mock} from 'mock-json-schema';
import {Request, Response, NextFunction} from 'express';
import {PetApiToken, StoreApiToken, UserApiToken} from './server/apis';
import {makePetHandlerHandler, makeStoreHandlerHandler, makeUserHandlerHandler} from './server/handlers';
import {FrameworkUtils} from './server/internal';
import {setup} from './server/services/setup';
import jsonOsSpec from './petstore.bundle.json';

(async () => {
	const oaSpec = {
		// When TypeScript/nodejs "imports" json, for some reason it loads top level arrays and objects as getters; Perform a spread operation to get a POJSO.
		...jsonOsSpec
	} as OpenAPIV3_1.Document;

	// Setup the Context Root.
	const container = new Container();
	setup(container);
	// FrameworkUtils provides utilities, as well as data response mocking services.
	const utils = new FrameworkUtils(mock as any, true);
	// express-openapi-validator requires all handlers to be defined in a single keyed object.
	let singularity = {};
	Object.assign(singularity, makePetHandlerHandler(utils, container.get(PetApiToken)));
	Object.assign(singularity, makeStoreHandlerHandler(utils, container.get(StoreApiToken)));
	Object.assign(singularity, makeUserHandlerHandler(utils, container.get(UserApiToken)));

	console.log('Initializing...');
	const api = OpenApiValidator.middleware({
		apiSpec: oaSpec as any,
		validateRequests: true,
		operationHandlers: {
			basePath: oaSpec.servers[0].url,
			resolver: (_: string, route: { basePath: string; openApiRoute: string; method: string }) => {
				let rt = route.openApiRoute.toLowerCase();
				if (rt[0] === '/')
					rt = rt.slice(1);
				if (route.basePath)
					rt = rt.slice(route.basePath.length);
				const key = `$${rt}!${route.method.toUpperCase()}`;
				if (typeof singularity[key] === 'function')
					return singularity[key];
				// If we don't have a handler for this route, return a 404 handler.
				return (_req: Request, res: Response, _next: NextFunction) => {
					res.status(404).json({error: `No handler for ${rt}`});
				}
			}
		},
		$refParser: {
			mode: 'dereference',
		}
	});

	const app = express();
	app.use(express.urlencoded({extended: false}));
	app.use(express.json());
	app.use(express.text());
	app.use(oaSpec.servers[0].url, api);
	
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
