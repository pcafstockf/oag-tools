# oag-tools — AI Coding Assistant Guide

## Project Identity

Two CLI tools for OpenAPI code generation:
- **`assemble`** — uplifts/repairs/bundles OpenAPI specs to validated v3.1
- **`generate`** — produces TypeScript code (client/server, node/browser, multiple frameworks) from v3.1 bundles

## Dev Workflow

No build step needed for development. Uses `ts-node` with source maps and transpile-only mode:
```
npm run assembler:dev -- -v -c <fixture-config.json5>
npm run generator:dev -- -v -c <fixture-config.json5>
```
- `-c` accepts a json5 config file (equivalent to passing all args on CLI)
- `-v` increases verbosity
- `-p key=value` passes property overrides

Fixtures in `fixtures/` are real-world project configs used as test inputs. They are NOT part of the tool itself.

## Two-Pass Architecture

```
OpenAPI spec → assemble → validated v3.1 bundle → generate → lang-neutral model → TypeScript (via ts-morph)
```

The lang-neutral model is an intermediate representation of data types, APIs, and methods independent of target language. See `oag-shared/src/lang-neutral/ReadMe.md` for its concepts (Model kinds, allOf/oneOf/anyOf mapping, Method properties).

## Generator Internals — Critical Flow

1. `swagger-parser.dereference()` resolves all `$ref`. **Beware:** it can create duplicate schema objects when `$ref` coexists with other keywords (same title, different object identity).
2. `visitSchema()` in `lang-neutral-generator.ts` creates models, tags them onto schemas via the `CodeGenAst` symbol, and guards against revisits via the `seenSchema` Set. Only newly created models trigger child traversal.
3. Child schemas are visited recursively via `super.visitSchema()` (the base visitor in `document-visitor.ts`).
4. `processSchemaJoins()` runs AFTER children are visited — it connects allOf/oneOf/anyOf member models to the parent model.
5. Models are generated in parallel via `Promise.all`, then APIs are generated sequentially after all models complete.

## Key Patterns and Gotchas

- **`seenSchema` + `CodeGenAst`**: Deduplication and bidirectional schema-to-model linkage. Never bypass. Without it, circular refs cause infinite recursion and models get duplicated.
- **`#genState` memoization**: Promise-level reentrancy guard on `MixTsmorphModel.generate()`. Ensures parallel model generation doesn't call `generateModel()` twice for the same model.
- **Interface vs type alias**: Determined in `createIntf()` (tsmorph-model.ts) by presence of unions, fake (non-exported) models, or anonymous extends. Named-only extends with no unions produce an interface; anything else produces a type alias.
- **Same-named allOf members**: `swagger-parser.dereference()` can produce allOf members with the same identifier as the parent. `processSchemaJoins` absorbs these (transfers their unions and extends) rather than creating self-referential extends.
- **`bindAst()`**: Only defines `$ast` if not already present (non-destructive). Safe to call multiple times on the same object.
- **`CodeGenCommonModelsToken`**: A factory FUNCTION, not a model. Must be called: `container.get(CodeGenCommonModelsToken)('string')`. Returns a model instance.
- **Import paths**: Not everything is re-exported through index files.
  - `oag-shared/lang-neutral` — index: public API (Model, Api, Parameter)
  - `oag-shared/lang-neutral/lang-neutral` — type guards (`isIdentifiedLangNeutral`), `CodeGenAst` symbol
  - `oag-shared/lang-neutral/base` — base classes and tokens (BaseRecordModel, CodeGenRecordModelToken)
  - `oag-shared/lang-neutral/model` — model interfaces, type guards (`isRecordModel`, `isUnionModel`), CommonModelKeys

## visitSchema Internals

Understanding `visitSchema()` in `lang-neutral-generator.ts` prevents the most common debugging dead ends.

**Schema type inference chain** — When `schema.type` is missing, the code infers it in this order:
1. Has `items` → `'array'`
2. Has `properties`, `additionalProperties`, or `discriminator` → `'object'`
3. Has `enum` → infer from `typeof enum[0]` (string, number, boolean)
4. Has `allOf` → always creates a record model
5. None of the above → falls through to `'any'` or other handling

**Synthetic schema pattern** — `model.init()` receives the schema object, and models read properties like `type` directly from it. When `visitSchema` infers a type not present in the original schema (e.g. enum-only schemas have no `type` field), it must pass a synthetic schema: `{...schema, type: inferredType}`. Otherwise the model sees `undefined` for `type` and defaults incorrectly (e.g. `BasePrimitiveModel.jsdType` falls through to `'object'`). This same pattern applies to multi-type union members — each must get `{...schema, type: singleType}`, not the full multi-type array.

**`addUnion()` exists on BOTH `BaseRecordModel` and `BaseUnionModel`** — This is intentional. Complex schemas can have both `allOf` (record) and `oneOf`/`anyOf` (union) simultaneously. The model starts as a record (for allOf), then unions are added to it via `addUnion()`.

**`swagger-parser.dereference()` duplicate creation mechanism** — Specifically: when a schema has both `$ref` AND other keywords (like `title`), dereference creates a NEW in-memory object merging the referenced schema's properties with the additional keywords. Result: two distinct JavaScript objects with the same title/identifier. This is why `processSchemaJoins` must detect same-named allOf members — they are legitimate but distinct objects that represent the same logical schema.

## Source Layout

Where to look for each concern:
- `oag-shared/src/` — shared code: document visitor, lang-neutral model interfaces and base classes
- `tools/generate/src/lang-neutral-generator.ts` — visitor overrides, model creation, the core of code generation logic
- `tools/generate/src/generators/tsmorph/` — TypeScript-specific code generation (ts-morph AST manipulation)
- `tools/generate/src/generators/tsmorph/docs/` — template docs copied verbatim into generated output
- `tools/generate/src/generators/tsmorph/client/support/` — template source files copied into generated client output
- `tools/assemble/src/` — assembler: spec uplift, repair, and bundling

## Rules

- **Ask, don't assume.** When faced with ambiguity about intent, requirements, or approach, stop and ask the user. Do not make large assumptions.
- **When a request is denied, ask why.** Do not investigate or speculate about the reason — just ask the user directly.
- Fixtures are stimuli, not subjects. When a fixture-driven run fails, the bug is in the tool source, not the fixture. Inspect the bundle to distinguish spec issues from tool bugs.
- Generated output IS the verification. Check the actual generated files for correctness, not just exit codes.
- Template docs in `generators/tsmorph/docs/` are copied into every generated project. Changes affect all users.
- Template source in `generators/tsmorph/client/support/` and `generators/tsmorph/server/support/` are also copied into generated output. These are user-facing files.
- Do not duplicate code into documentation. Docs describe relationships and concepts; readers have full source access.

## Debugging

When the generator crashes or produces wrong output:
1. Run with `-v` for verbose output showing the lang-neutral model
2. Stack traces reference `.ts` source with accurate line numbers (source maps active)
3. Distinguish crash site from root cause — bad values often originate several frames above the throw
4. Inspect the fixture's bundle JSON directly to see what data the tool received
5. Check the verbose lang-neutral model output (type info per model) before looking at ts-morph output
