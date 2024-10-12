import SwaggerParser from '@apidevtools/swagger-parser';
import {mapSeries as asyncMapSeries} from 'async';
import {parse as json5Parse} from 'json5';
import {isEqual as lodashIsEqual, merge as lodashMerge, mergeWith as lodashMergeWith, set as lodashSet, unionWith as lodashUnionWith} from 'lodash';
import constants from 'node:constants';
import * as fs from 'node:fs';
import path from 'node:path';
import {isFileSystemPath, safeLStatSync} from 'oag-shared/utils/misc-utils';
import {OpenAPI, OpenAPIV2, OpenAPIV3, OpenAPIV3_1} from 'openapi-types';
import {coerce as semverCoerce, parse as semverParse, SemVer} from 'semver';
import converter from 'swagger2openapi';
import {Transform3to3_1} from './oa-3->3_1-transformer';

export class OpenApiInputProcessor {
	constructor() {
	}

	private async attemptBundleV3(parser: SwaggerParser, doc: OpenAPI.Document): Promise<OpenAPIV3.Document | OpenAPIV3_1.Document> {
		let docVers: SemVer | null = null;
		if ((doc as OpenAPIV3.Document).openapi)
			docVers = semverParse((doc as OpenAPIV3.Document).openapi);
		else if ((doc as OpenAPIV2.Document).swagger)
			docVers = semverCoerce((doc as OpenAPIV2.Document).swagger);
		if (!docVers)
			throw new Error('Unknown document version');

		// Ensure we have at least a 3.x document
		if (docVers.major < 3) {
			const result = await converter.convertObj(doc as OpenAPIV2.Document, {
				// Fix up any minor issues that can be fixed.
				patch: true,
				// Resolve external references.
				resolve: true
			});
			return result.openapi;
		}
		else
			return await parser.bundle(doc) as OpenAPIV3.Document | OpenAPIV3_1.Document;
	}

	async merge(location: string | string[], strict?: boolean, envVars?: Record<string, string>): Promise<OpenAPIV3.Document | OpenAPIV3_1.Document> {
		let doc: OpenAPI.Document;
		const parser = new SwaggerParser();
		if (Array.isArray(location)) {
			const cwd = process.cwd();
			const docs = await asyncMapSeries(location, async (loc: string) => {
				try {
					const p = new SwaggerParser();
					const isLocalFile = await isFileSystemPath(loc);
					if (isLocalFile) {
						loc = path.resolve(loc);
						process.chdir(path.dirname(loc));
					}
					try {
						return await p.parse(loc).then(d => this.attemptBundleV3(p, d));
					}
					finally {
						process.chdir(cwd);
					}
				}
				catch (e: any) {
					process.chdir(cwd);
					if ((e instanceof SyntaxError || e.errno === -constants.ENOENT) && safeLStatSync(loc)) {
						const content = await fs.promises.readFile(loc);
						doc = json5Parse(content.toString('utf8'));
						if (Object.keys(doc).length > 0)
							return doc;
					}
					throw e;
				}
			});

			// Use the merging algorithm from dyflex-config to support union and replacement merging.
			let deletes: (() => void)[] = [];
			const mergerFn = (objValue: any, srcValue: any, key: string, object: any) => {
				if (key?.startsWith('!')) {
					deletes.push(() => {
						delete object[key];
					});
					if (srcValue === null)  // dyflex-config supports a null replacement, but that has no meaning in OpenAPI, so we leverage that to mean 'delete'.
						deletes.push(() => {
							delete object[key.substring(1)];
						});
					else
						object[key.substring(1)] = srcValue;
				}
				else if (key?.startsWith('~')) {
					if (object[srcValue])
						lodashMergeWith(object[srcValue], object[key.substring(1)], mergerFn);
					else if (object[key.substring(1)])
						object[srcValue] = object[key.substring(1)];
					deletes.push(() => {
						delete object[key];
						delete object[key.substring(1)];
					});
				}
				else if (Array.isArray(srcValue)) {
					// Arrays starting with
					//  '~' will be replaced (see above).
					//  '%' will follow lodash merge semantics where elements at objValue[n] are replaced by elements at srcValue[n].
					//  '-' will remove any elements in srcValue that are found in object.
					//  Otherwise, arrays will be merged with union semantics.
					if (key?.startsWith('%')) {
						object[key.substring(1)] = lodashMergeWith(object[key.substring(1)], srcValue, mergerFn);
						deletes.push(() => {
							delete object[key];
						});
					}
					else if (key?.startsWith('-')) {
						const existing = object[key.substring(1)];
						const tbr = new Set(srcValue);
						for (let i = existing.length - 1; i >= 0; i--) {
							if (tbr.has(existing[i]))
								existing.splice(i, 1);
						}
						deletes.push(() => {
							delete object[key];
						});
					}
					else
						return lodashUnionWith(objValue, srcValue, lodashIsEqual);
				}
				return undefined;
			};
			const obj = docs.slice(1).reduce((p, v) => {
				return lodashMergeWith(p, v, mergerFn);
			}, docs[0] as OpenAPI.Document);
			deletes.forEach(d => d());
			doc = await parser.parse(obj);
		}
		else {
			const cwd = process.cwd();
			const isLocalFile = await isFileSystemPath(location);
			if (isLocalFile) {
				location = path.resolve(location);
				process.chdir(path.dirname(location));
			}
			try {
				doc = await parser.parse(location).then((d) => this.attemptBundleV3(parser, d));
			}
			finally {
				process.chdir(cwd);
			}
		}
		if (envVars)
			Object.keys(envVars).forEach(key => {
				lodashSet(doc, key, envVars[key]);
			});
		return doc as OpenAPIV3.Document | OpenAPIV3_1.Document;
	}

	public async bundleAndValidateDocument(doc: OpenAPIV3.Document | OpenAPIV3_1.Document): Promise<OpenAPIV3.Document | OpenAPIV3_1.Document> {
		let parser = new SwaggerParser();
		const bdoc = await parser.bundle(doc) as OpenAPIV3.Document | OpenAPIV3_1.Document;
		// Validating resolves all references which we do not want to do.
		// Clone deep and validate the clone.
		await parser.validate(structuredClone(bdoc));
		return bdoc;
	}

	public async ensure31Document(doc: OpenAPIV3.Document | OpenAPIV3_1.Document): Promise<OpenAPIV3_1.Document> {
		const docVers = semverParse((doc as OpenAPIV3.Document).openapi)!;
		if (docVers.major === 3 && docVers.minor < 1) {
			const visitor = new Transform3to3_1();
			await visitor.convert(doc as OpenAPIV3.Document);
		}
		return doc as OpenAPIV3_1.Document;
	}
}
