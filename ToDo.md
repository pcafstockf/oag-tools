* Implement full support for OpenAPI v3.2 released September 19, 2025 (includes streaming, and OAuth 2.0 Device Authorization Grant (RFC 8628))

* generate a setup.ts file in the handlers that binds into a singularity (framework specific).
    * Also re-export the injection token from there.
    * rename services/setup exported function from 'setup' to setupServices.
    * setup.fog.md is being generated for clients
* Further abstract Models (e.g. less work for code generators).
* Implement generators for Java, C++, CodeGenJson, Python, Go, C#.
