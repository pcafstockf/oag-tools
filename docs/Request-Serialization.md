BodySerializerFn is a config you must supply, as there are so many ways to serialize a Request body,
that it is not feasible to define all the combinations of content-type with http-client implementation.  
Below are sample implementations for different libraries.

```typescript
export function bodySerializer(op: OperationDesc, urlPath: string, mediaType: string, body: any, hdrs: Record<string, string>) {
	if (data instanceof FormData)
		return data;
	return Object.keys(data).reduce((p, key) => {
		p.set(key, data[key]);
		return p;
	}, new FormData());
}
```

```typescript
import {FormData} from "formdata-node"

export function bodySerializer(op: OperationDesc, urlPath: string, mediaType: string, body: any, hdrs: Record<string, string>) {
	if (data instanceof FormData)
		return data;
	return Object.keys(data).reduce((p, key) => {
		p.set(key, data[key]);
		return p;
	}, new FormData());
}
```

```typescript
import {Readable} from 'node:stream';
import {FormDataEncoder, FormDataLike} from "form-data-encoder";
import {FormData} from "formdata-node"

export function bodySerializer(op: OperationDesc, urlPath: string, mediaType: string, body: any, hdrs: Record<string, string>) {
	const encoder = new FormDataEncoder(Object.keys(data).reduce((p, key) => {
		p.append(key, data[key]);
		return p;
	}, new FormData() as FormDataLike));
	Object.assign(hdrs, encoder.headers);
	return Readable.from(encoder)
}
```
