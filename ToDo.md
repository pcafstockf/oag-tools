* Better was to not overwrite impls (when so configured). Currently just returns null for source, but that breaks when we go to generate setup.
* generate a setup.ts file in the handlers that binds into a singularity (framework specific).
    * Also re-export the injection token from there.
    * rename services/setup exported function from 'setup' to setupServices.
    * setup.fog.md is being generated for clients
* FetchHttpClient is not exported.
* package into npm dist and add some ./.bin executables for simpler invocation
* ReadMe updates for everything, including a super simple client pet-store, a simple but mocked server pet-store, and then a fully mocked client pet-store.
* Further abstract Models (e.g. less work for code generators).
* Implement generators for Java, C++, CodeGenJson, Python, Go, C#.
