# Code Generator Ast

OpenApi is basically an Abstract Syntax Tree describing a json centric Domain Specific Language.   
This module transforms the OpenApi DSL into a code generation DSL for for producing object-oriented remote API services.  
The code generation Ast contains 3 primary nodes:

* A `Model` (aka OpenApi ObjectSchema)
* An `Api` (aka OpenApi TagObject)
* A `Method` (aka OpenApi OperationObject)

Each of these Ast contain a reference back to their underlying OpenApi element.  
A `Method` is part of an `Api`, takes zero or more `Model` parameters, and optionally returns a `Model` as a result.
Unlike traditional Ast and even OpenApi itself, these Ast nodes are **interfaces** (as opposed to data records / structures).  
They expose methods to process data, but how they store/access that data is up to them.

We will refer to these code generation Ast interfaces as the "`CodeGenAst`"

## Language Neutral `Model` kinds

These are denoted by the `kind` property of a `Model`

* `primitive` is what most languages call a `primitive`:
    * `integer`, `number`, `string`, `boolean`, `null`
    * A pseudo primitive `any` is also possible
* `array` matches the OpenApi schema type 'array'
* `record` matches the OpenApi schema type 'object'
    * Calling it an 'object' is ambiguous (is it a type/interface/record, or instance), so we go with record.
* `union` Can be of one `kind` or another (e.g. TypeScript `|`).
* `intersection` All constituent `kind`s at the same time (e.g. TypeScript `&`)
* `discriminated` Multiple `record` kinds, where each has a common **property** with a unique **value** (to tell them apart).

Note:  
`union`, `intersection`, `discriminated` are only roughly related to `anyOf`, `allOf`, `oneOf` (and mixed schema) from OpenApi.
The transformer from OpenApi DSL -> `CodeGen` DSL is responsible for building an appropriate `Model` to represent the OpenApi intent.  
This include for example when the `type` property is missing from an OpenApi schema object, but it has a `properties` property, `CodeGen` will create the schema as `kind = record`.

## Language Neutral `Method` properties

* `parameter` Zero or more named elements each of which has a single associated `Model`. Matches the OpenApi Parameter element.
* `request` A single argument which will be an artificially created `union` (to represent possible content types). Matches the OpenApi RequestBody element.
    * The constituent `Model`s of the `union` will be arranged in order of preference (some content types are more desirable than others).
* `return` An ordered map of artificially created `union`s where map keys represent return codes. Matches the OpenApi Responses element.
