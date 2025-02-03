# Media Types and Code Generation

I had confusion around mime, media type, content type, and how all those impact code generation.  
Now I have source which I can find again, and maybe it will help you too  :-)

Many thanks to Borja for [this excellent article](https://dev.to/bcanseco/request-body-encoding-json-x-www-form-urlencoded-ad9) that helped me get my thoughts straight.  
Media Type is the proper technical name for the old 'MIME' term.  
Content-Type is the name of the HTTP **header** field used to specify a Media Type.  
The best part of the article was a reminder that a lot of REST calls, incur the overhead of a preflight OPTIONS call!

## What does this mean for code generation?

I've put together the following guidelines (which may evolve as my understanding grows).  
This is described in TypeScript notation, but should be true for other languages as well.

I believe these rules only apply to client generators, as server frameworks have plugins for processing the incoming request  
(e.g. `app.use(express.urlencoded({ extended: true }));` and `fastify.register(require('@fastify/multipart'));` )

### Request

Handling of specified **request** media types in an OpenAPI document should be evaluated in the following order by (client) code generators.
In other words for each body, if given MediaType is specified **and** the conditions are met...

#### application/x-www-form-urlencoded

If all properties of schema are (! (object || array)) && (! binaryProperties) && (config.client.allowedMediaTypes.indexOf('application/x-www-form-urlencoded') >= 0):  
Declare type of object | URLSearchParams | FormData, emit code to covert to URLSearchParams and send as application/x-www-form-urlencoded
Note that you could allow arrays, but application/json might be better.

#### multipart/form-data

If all properties of schema are (! (object || array)) && (reqMediaTypeSupported):  
Declare type of object | FormData, emit code to covert to FormData and send as multipart/form-data
Note that if env is node, the generator will need to ensure a FormData library (e.g. config.libs['form-data']).

#### application/octet-stream || (config.recognizedBinaryTypes)

If schema is an OpenAPI binary string && (reqMediaTypeSupported):  
Declare type ArrayBuffer (or Buffer if env is node) and send as the media type.
Also set Content-Transfer-Encoding: binary

#### text/plain || (config.recognizedTextTypes)

If schema is an OpenAPI binary string && (reqMediaTypeSupported):  
Declare type ArrayBuffer (or Buffer), encode as base64, set Content-Transfer-Encoding: base64, and send as text/plain  
If schema is (! (object || array)) && (reqMediaTypeSupported):
Declare type same as schema (e.g. number, string, boolean), convert to f string and text/plain

#### application/json

If (reqMediaTypeSupported):  
Declare as whatever schema is and send as application/json

#### application/xml

If xml library is configured && schema is (object || array) && (mediaTypeSupported):  
Declare as object or array and send as application/xml

#### Otherwise

Declare as whatever schema is, then JSON.stringify and send as text/plain

### Response

Clients need to specify what they will Accept as a response.
For the media types they do Accept, the schema for each 2XX response should be declared within the return type.

#### application/octet-stream || (config.recognizedBinaryTypes)

If schema is an OpenAPI binary string && (rspMediaTypeSupported):  
Declare response as ArrayBuffer (or Buffer if env is node) and set Accept to mediaType.

#### application/json

Declare response as whatever schema is and set Accept to application/json

#### application/xml

If xml library is configured && schema is (object || array) && (mediaTypeSupported):  
Declare response as object or array and set Accept to application/xml

#### Otherwise

Declare response as schema.
Set Accept to application/json, rspMediaTypeSupported, application/octet-stream, text/plain, */*.
Emit http-client aware, intelligent code to convert response data to schema type.

## Summary

The above all needs to happen at the generator level, because a http-client (like Axios) cannot know which path to take because it does not know what the schema allows.
