# Petstore Example

The `fixtures/petstore/` directory contains configuration files for generating client and server code from the classic Petstore specification.

## Prerequisites

Build the tools (from the project root):
```shell
npm run build:assembler
npm run build:generator
```

## Assemble

The petstore spec must first be assembled into a validated OpenAPI v3.1 bundle.
A pre-built bundle (`petstore.bundle.json`) is already included, but you can regenerate it:

```shell
oag-assemble -c fixtures/petstore/oa-bundle.json5
```

## Generate Client

```shell
oag-generate -c fixtures/petstore/gen-client.json5
```

Adjust the output path (`o`) in the config or override it on the command line as needed.

## Generate Server

Two server frameworks are supported:

| Framework | Config |
|---|---|
| express-openapi-validator | `gen-server-eov.json5` |
| fastify-openapi-glue | `gen-server-fog.json5` |

```shell
oag-generate -c fixtures/petstore/gen-server-eov.json5
```

or

```shell
oag-generate -c fixtures/petstore/gen-server-fog.json5
```

## Configuration

All config files use json5 format. Key fields:

- `i` — input spec (the assembled v3.1 bundle)
- `o` — output directory
- `d` — delete mode (`all` clears the output directory before generating)
- `r` — role (`client` or `server`)
- `p` — array of property overrides for customizing generation

Use `-v` for verbose output, or `-p key=value` on the command line to override individual properties.
