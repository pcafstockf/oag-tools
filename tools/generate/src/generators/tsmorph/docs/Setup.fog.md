### Setup for oag-tools generated Fastify server .

A simple server (using fastify-openapi-glue) is really just this simple.  
It will provide respond (with mock data) to every single endpoint defined in the specification.
(e.g. use oag-tools to generate, and your frontend development is no longer waiting on the backend).

```typescript
import 'reflect-metadata';
import {Container} from 'async-injection';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {loadConfigFile, makeConfig} from 'dyflex-config';
import fastify from 'fastify';
import {mock} from 'mock-json-schema';
import * as fs from 'node:fs';
import {OpenAPIV3_1} from 'openapi-types';
import {DefaultPetStoreSecurityConfig} from './config/security-handler';
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
});
```
