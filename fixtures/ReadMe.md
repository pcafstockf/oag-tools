# Fixture Configurations

Each fixture directory contains `json5` config files that exercise different assembler and generator settings. Together they cover the full feature space without redundancy.

## Generator Coverage by Config

| Config | Role | Target | HTTP | DI | Mock | Server FW | Notes |
|--------|------|--------|------|----|------|-----------|-------|
| petstore-v2/gen-client-axios | client | browser | axios | async-injection | — | — | Uplifted v2 spec |
| petstore-v2/gen-client-node | client | node | node | async-injection | sinon | — | Native http/https client |
| petstore-v2/gen-server-fog | server | — | — | async-injection | — | fastify-openapi-glue | |
| petstore-v3/gen-client-angular | client | browser | angular | angular | — | — | Angular DI + HttpClient |
| petstore-v3/gen-client-node | client | node | fetch | async-injection | node | — | Custom json/mock dirs |
| petstore-v3/gen-client-fetch-jasmine | client | browser | fetch | disabled | jasmine | — | No DI scaffolding |
| petstore-v3/gen-server-eov | server | — | — | async-injection | — | express-openapi-validator | |
| naming/gen-client | client | browser | fetch | async-injection | — | — | Custom dirs, suffixes, templates |
| edge-cases/gen-client | client | — | fetch | async-injection | — | — | allOf + anyOf composition |

## Generator Coverage by Axis

| Axis | Values | Where |
|------|--------|-------|
| httpsup | fetch, axios, node, angular | v3-node, v2-axios, v2-node, v3-angular |
| DI | async-injection, angular, disabled | v2-*, v3-node / v3-angular / v3-jasmine |
| mocklib | node, sinon, jasmine | v3-node / v2-node / v3-jasmine |
| target | browser, node | v2-axios, v3-angular, v3-jasmine, naming / v2-node, v3-node |
| server framework | express-openapi-validator, fastify-openapi-glue | v3-eov / v2-fog |
| naming customization | default, full custom | most configs / naming |

## Assembler Coverage

| Config | Merge | Fix Plugin | Transform Plugin | Upgrade | Notes |
|--------|-------|------------|------------------|---------|-------|
| petstore-v2/oag-assemble | — | — | — | v2 → v3.1 | Swagger v2 uplift |
| petstore-v3/oag-assemble | — | — | — | v3.0 → v3.1 | |
| naming/oag-assemble | patch.json5 | consolidate-query-params | recase-path-params | v3.0 → v3.1 | Full pipeline demo |

| Axis | Values | Where |
|------|--------|-------|
| patch merge (`-m`) | operationId injection | naming |
| fix plugin (`-f`) | consolidate-query-params | naming |
| transform plugin (`-t`) | recase-path-params | naming |
| spec upgrade (`-u`) | v2 → v3.1, v3.0 → v3.1 | petstore-v2, petstore-v3, naming |
