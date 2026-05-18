# Client Request / Response Processing

Generated client code provides a configurable pipeline for processing outgoing requests and incoming responses.
All configuration is supplied via the `ApiClientConfig` object passed to `setupApis()`.
The four callbacks described below are all **optional** — `paramSerializers` and `bodySerializer` ship with generated defaults, while `reqTransformer` and `resTransformer` are only needed for custom processing (auth, logging, etc.).

Every callback receives an `OperationDesc` (operation id, URL pattern, HTTP method) so you can make per-endpoint decisions.

See `internal/client-config.ts` (within generated output) for the full `ApiClientConfig` interface.

## Parameter Serialization (`paramSerializers`)

OpenAPI defines many parameter serialization styles — matrix, label, form, simple, space-delimited, pipe-delimited, and deep-object — each with an optional `explode` variant.
The generated code selects the correct serializer at build time based on each parameter's `style` and `explode` attributes in the spec.

A spec-compliant implementation is generated in `internal/param-serializers.ts`.
You can supply your own object with the same shape if you need different behavior (e.g. custom encoding rules).

## Body Serialization (`bodySerializer`)

Called before sending any request that has a body.
Your function receives the operation descriptor, resolved URL path, negotiated media type, the body value, and a mutable headers map.
It should return the serialized body ready for the http-client, and may modify `hdrs` (e.g. to set `Content-Type` or `Content-Transfer-Encoding`).

A reference implementation is generated in `internal/body-serializer.ts` — it JSON-stringifies `application/json` bodies and passes everything else through.
For specialized needs (streaming multipart, custom binary encoding, etc.), write your own function matching the `BodySerializerFn` signature.

See [MediaTypesAndCodeGen.md](MediaTypesAndCodeGen.md) for the media type evaluation order the generator uses when choosing content types.

## Request Transformer (`reqTransformer`)

A pre-processing hook called once per request before it is sent.
This is the place to inject auth tokens, add custom headers, and control cookie submission.

**The signature varies by target environment:**

- **Browser clients:** The fourth parameter is `credentials` — a fetch `RequestCredentials` value (`'omit'`, `'same-origin'`, `'include'`, or `undefined`). Return the (possibly changed) credentials value.
- **Node clients:** The fourth parameter is `cookies` — a mutable `Record<string, () => string>` of lazy cookie getters. Return the (possibly changed) cookies map.

Both variants receive a `security` parameter: a preference-ordered array of security scheme maps from the spec (e.g. `[{ bearerAuth: [] }]`).
Implementors should apply the first scheme they understand and skip auth when the array is empty.

See `internal/client-transformers.ts` (within generated output) for the type definition matching your target environment.

## Response Transformer (`resTransformer`)

A post-processing hook called after the HTTP client receives a response, before it is returned to the caller.
Use this for response logging, error normalization, or header inspection.
The signature is the same in both browser and node environments.
