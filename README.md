# oag-tools

Collection of tools for high quality OpenApi code generation

## Overview

OpenApi Generator Tools aims to abstract away the notion of http transport for clients and servers wishing to implement an OpenAPiispecification.
Your application (client), or service handlers (server) can focus on business logic and leave communications to generated code.

## Design

An OpenApi specification is effectively a Domain-Specific-Language for machine to machine communication over a REST protocol.  
oag-tools transforms that into a [language neutral model](oag-shared/src/lang-neutral/ReadMe.md) representing data types and class methods for passing that data.  
Once this first pass transformation is complete, the generate tool transforms the language neutral model into a language specific model.
Currently TypeScript is fully supported (client and server, multiple frameworks). Java support is planned next.

## Implementation

Rather than creating a generator that can handle all versions of an OpenApi specification, the collection
contains tools and plugins to assist you in migrating from Swagger v2 and OpenApi v3 to OpenApiv3.1.  
This allows the generator to focus on JSON Schema base OpenApi v3.1 documents exclusively (greatly simplifying the code generation process itself).

`assemble` is a cli tool for uplifting schema's, repairing common schema errors, and bundling a schema:

* Invalid URI-Template names
* Improperly specified query params
* Missing schema names (helpful for more readable code generation)
* Custom plugin architecture to support other modifications that may need to be made to our specification.
* Patching in missing information into a schema you do not control.
* Upgrade minor well know changes to bring v3.1 compliance to your specification.
* Transforming original documents and fragments into a single v3.1 validated bundle.

`generate` is a cle tool that requires a validated v3.1 JSON Schema based OpenApi specification as imput.
The generator:

* Supports client / server, and node / browser, for many frameworks.
* Opinionated, but highly customizable.
* Does not require, but strongly encourages the use of Dependency Injection.

NOTE:
This is first draft documentation. Please feel free to make suggestions and look for more to come.
