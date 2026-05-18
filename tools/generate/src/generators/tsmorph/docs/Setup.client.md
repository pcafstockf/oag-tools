### Setup for oag-tools generated client

#### Getting started

1. **Create a dependency injection container** using `async-injection`.
2. **Call `setupApis()`** (in `services/setup.ts`) with an HTTP client instance and a configuration object specifying at minimum `baseURL`, `paramSerializers`, and `bodySerializer`.
3. **Retrieve API instances** from the container using the generated API tokens (in `apis.ts`) and call methods directly.

#### Key generated files

- `apis.ts` — API interface tokens for dependency injection
- `services/setup.ts` — Registers API service implementations in the DI container
- `internal/http-client-svc.ts` — HTTP client factory (`makeFetchHttpClient()`)
- `internal/param-serializers.ts` — Spec-compliant parameter serialization
- `internal/body-serializer.ts` — Reference body serializer
- `internal/client-config.ts` — Configuration interface

For details on all the configurable callbacks (body serialization, parameter serialization, request/response transformers), see [docs/req-rsp-processing.md](../../docs/req-rsp-processing.md).

#### Mocking

The generator can optionally produce mock implementations of each API interface (in `mocks/`).
Call `setupMocks()` instead of (or in addition to) `setupApis()` to register mock services.
Mocks can be used for testing or embedded in your application runtime to eliminate dependence on a remote server during development.

## Example

A little command line tool to query a Pet by id, is really just this simple.

```typescript
import "reflect-metadata";
import {Container} from 'async-injection';
import {PetApiToken} from './client/apis';
import {makeFetchHttpClient} from './client/internal/http-client-svc';
import {ParamSerializers} from './client/internal/param-serializers';
import {specCompliantFetchBodySerializer} from './client/internal/body-serializer';
import {setupMocks} from './client/mocks/setup';
import {setupApis} from './client/services/setup';

// If you want runtime mocking...
// import {mock as mockJson} from 'mock-json-schema';
// import {DefaultMockDataGenerator} from './client/internal/data-mocking';
// import {jasmine} from 'jasmine';  // (adjust for jasmine, sinon, or node as needed)

(async () => {
	// new jasmine();   // Runtime usage of jasmine (outside a spec runner) requires initialization.
	const container = new Container();
	// setupMocks(container, new DefaultMockDataGenerator(mockJson as any));

	// Obviously if you are using mocks, you do not need to setup Apis (or configure http services).
	setupApis(container, makeFetchHttpClient(), {
		baseURL: 'http://localhost:9000',
		paramSerializers: ParamSerializers,
		bodySerializer: specCompliantFetchBodySerializer
	});

	const petApi = container.get(PetApiToken);
	const result = await petApi.getPetById(12n);
	console.log(result);
})().catch(e => {
	console.error(e);
});
```
