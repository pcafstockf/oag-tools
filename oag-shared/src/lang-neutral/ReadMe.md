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

* `<<empty-string>>`: aka no-kind:
    * The no-kind model has any/all the properties of `Model`. It is essentially a "base" kind.
* `primitive`: is what most languages call a "primitive":
    * `integer`, `number`, `string`, `enum` | `boolean`, `null`
    * A pseudo primitive `any` is also possible
* `array`: matches the OpenApi schema type 'array'
* `record`: matches the OpenApi schema type 'object'
    * Calling it an 'object' is ambiguous (is it a type/interface/record, or instance), so we go with record.
    * Complex records will also contain one or more of the OpenApi `anyOf`, `allOf`, `oneOf` specifiers.
    * `not`, is unsupported by the code generator. While it is provable by a validator, it is not really a type (none of the supported languages support "any **except**", types).
* `synthetic`: has `anyOf`, `allOf`, `oneOf` (like a Complex `record`) but is not a `record` \ object and is not based on OpenApi.
    * Created by the generator to represent combinations of other models as needed.
* `typed`: similar to `<<empty-string>>` but has an explicit textual type string that the target language is assumed to understand.
    * (e.g `Date` in JavaScript, or a `Container` type globally imported from a 3rd party library).
      Note:  
      The transformer from OpenApi DSL -> `CodeGen` DSL is responsible for building an appropriate `Model` to represent the OpenApi intent.  
      This include for example when the `type` property is missing from an OpenApi schema object, but it has a `properties` property, `CodeGen` will create the schema as `kind = record`.

`CodeGen` maps TypeScript to OpenApi roughly as:

* `allOf`: TypeScript intersection `&` (e.g. all constituent types at the same time).
    * Think of this as "imposes additional constraints" (e.g. must satisfy "all" of these)
    * Of course OpenApi types must match;
      Something cannot be a string and an array and an integer at the same time.
      Therefore, CodeGen will always create a `record` when it sees this, and the constituent types will be found in `extendsFrom`.
* `anyOf`: TypeScript union `|` (e.g. can be of one `kind` or another).
    * Constituent types will be found in `Model.unionOf`
* `oneOf`: TypeScript discriminated (e.g. multiple possible types, but only one actual type).
    * Commonly used programming language type systems cannot distinguish between `anyOf` and `oneOf`.
    * With `oneOf`, schema is chosen by matching the **data** against each possible schema.
      This means that a string schema can be distinguished from an integer schema, and from an object schema, by looking at the instances data type.
    * With "discriminated", schema is chosen based on the value of a specific field.  
      All schema need a common **property**, but each schema must declare a unique **value** for that property.
      Since a property is required, only `record` (aka objects) can have a discriminator.
    * NOTE: AJV supports `oneOf` and could be augmented to support discriminators, but it does not do so natively.

## "complex" `Model`s

OpenApi can be deceptively flexible, but intolerant of ambiguity.  
For example a Person entity could:

* Have properties (`name`, `age`) inherited from other schemas using `allOf`.
* Optionally include either a `Contact` schema or an `Address` schema using `anyOf`.
* And still have its own properties.

```yaml
  Person:
    type: object
    allOf:
      - $ref: #/components/schemas/NameAge
      - $ref: #/components/schemas/Origin
    anyOf:
      - $ref: #/components/schemas/Contacts
      - $ref: #/components/schemas/Addresses
    properties:
      race:
        type: string
```

One possible implementation of this could be:

```typescript
interface PersonBase extends NameAge, Origin {
  race: string;
}
type Person = PersonBase & (Contacts | Addresses);
```

Complex models are well... complex.  
Implementations may need to synthetically create abstractions (such as `PersonBase` above) while avoiding name collisions.

However, the following OpenApi is invalid since an object with properties cannot have array items:

```yaml
Person:
  type: [object, null]
  properties:
    race:
      type: string
  items:
    type: string
```

Here is another example to consider:

```yaml
Values:
  type: array
  items:
    anyOf:
      - type: string
      - type: integer
```

This is an array that can contain strings or integers.  
Changing "anyOf" to "oneOf" would define an array with only strings or an array with only integers.

Lastly, `CodeGen` tries to honor **valid** OpenApi, even if it is not considered best practice.
Given:

```yaml
Values:
  type: [array, boolean]
  anyOf:
    - type: string
    - type: number
# or even
Alt:
  type: [array]
  anyOf:
    - type: boolean
    - type: string
    - type: number
```

`CodeGen` will produce:

```typescript
type Values = Array | boolean | string | number;
```

## Language Neutral `Method` properties

* `parameter` Zero or more named elements each of which has a single associated `Model`. Matches the OpenApi Parameter element.
* `request` A single argument which will be an artificially created `union` (to represent possible content types). Matches the OpenApi RequestBody element.
    * The constituent `Model`s of the `union` will be arranged in order of preference (some content types are more desirable than others).
* `return` An ordered map of artificially created `union`s where map keys represent return codes. Matches the OpenApi Responses element.
