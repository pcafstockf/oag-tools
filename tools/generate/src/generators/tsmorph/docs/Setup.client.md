### Setup for oag-tools generated client.

A simple command line tool to query a Pet by id, is really just this simple.

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
// import {jasmine} from 'jamsine';  // (adjust for jasmine, sinon, or node as needed)

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
