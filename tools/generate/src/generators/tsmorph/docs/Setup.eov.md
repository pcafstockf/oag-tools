### Setup for oag-tools generated Express server .

A simple server (using express-openapi-validator) is really just this simple.  
It will provide respond (with mock data) to every single endpoint defined in the specification.
(e.g. use oag-tools to generate, and your frontend development is no longer waiting on the backend).

```typescript
import 'reflect-metadata';
import {Container} from 'async-injection';

(async () => {
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
