import {randomUUID} from 'crypto';
import * as JSON5 from 'json5';
import {template as lodashTemplate} from 'lodash';
import os from 'node:os';
import path from 'node:path';
import {CodeGenAst, isIdentifiedLangNeutral} from 'oag-shared/lang-neutral/lang-neutral';
import * as nameUtils from 'oag-shared/utils/name-utils';
import {OpenAPIV3_1} from 'openapi-types';
import {JSDocStructure, Node, SourceFile, StructureKind} from 'ts-morph';
import {isTsmorphModel, TsmorphModel} from './tsmorph-model';

export const TempFileName = '_$temp-File.ts';

/**
 * Associate a CodeGenAst with a tsmorph Node.
 * @param obj
 * @param ast
 */
export function bindAst<T extends Node = Node, N = Node>(obj: Omit<T, '$ast'>, ast: N): (T & { readonly $ast: N }) {
	if (obj && (!obj.hasOwnProperty('$ast')))
		Object.defineProperty(obj, '$ast', {
			get() {
				return ast;
			}
		});
	return obj as (T & { readonly $ast: N });
}

export function bindNext<T extends Node = Node, N extends Node = Node>(obj: Omit<T, '$next' | '$ast'>, next: N): (Omit<T, '$ast'> & { readonly $next?: N }) {
	if (obj && (!obj.hasOwnProperty('$next')))
		Object.defineProperty(obj, '$next', {
			get() {
				return next;
			}
		});
	return obj as (Omit<T, '$ast'> & { readonly $next: N });
}

/**
 * Returns true if 'src' and 'imphort' both live in the same ts-morph @see SourceFile
 * @param src
 * @param imphort
 * @param ignoreTmp
 * @protected
 */
export function isSameSourceFile<S extends Node, I extends Node>(src: S, imphort: I, ignoreTmp?: boolean): boolean {
	if (!imphort)
		return true;
	let srcSf: SourceFile = Node.isSourceFile(src) ? src as unknown as SourceFile : src.getSourceFile();
	if (Object.is(srcSf, imphort.getSourceFile()))
		return true;
	return imphort.getSourceFile().getBaseName() === TempFileName ? !ignoreTmp : false;
}

/**
 * If 'src' node is not in the same file as 'imphort' node, create a ts-morph import of imphort into 'src'.
 */
export function importIfNotSameFile<S extends Node, I extends Node>(src: S, imphort: I, imphortName: string, ignoreTmp?: boolean) {
	if (!isSameSourceFile(src, imphort, ignoreTmp)) {
		let srcSf: SourceFile = Node.isSourceFile(src) ? src as unknown as SourceFile : src.getSourceFile();
		const imphortFilePath = path.resolve(imphort.getSourceFile().getFilePath());
		const imphortDirPath = path.dirname(imphortFilePath);
		const imphortBaseName = path.basename(imphortFilePath, path.extname(imphortFilePath));
		const srcFilePath = path.resolve(srcSf.getFilePath());
		const srcDirPath = path.dirname(srcFilePath);
		const relPath = path.relative(srcDirPath, imphortDirPath);
		let relModule: string;
		if (relPath === '')
			relModule = './' + imphortBaseName;
		else
			relModule = path.join(relPath, imphortBaseName);
		return srcSf.addImportDeclaration({
			moduleSpecifier: relModule,
			namedImports: [imphortName]
		});
	}
	return undefined;
}

export function makeFakeIdentifier(): string {
	let id = nameUtils.setCase(randomUUID().replace('-', ''), 'pascal');
	let match = /([^a-z]*)(.+)/ig.exec(id);
	id = id.slice(match[1].length) + match[0];
	return id;
}

export function makeJsDocTxt(short: string | undefined, long: string | undefined): string {
	long = long?.trim();
	short = short?.trim();
	if (long) {
		if (short && long.toLowerCase().startsWith(short.toLowerCase()))
			return long;
		else if (short)
			return short + os.EOL + long;
		return long;
	}
	else if (short)
		return short;
	return '';
}

export function makeJsDoc<T extends OpenAPIV3_1.BaseSchemaObject | OpenAPIV3_1.TagObject | OpenAPIV3_1.OperationObject | OpenAPIV3_1.ParameterBaseObject = OpenAPIV3_1.BaseSchemaObject | OpenAPIV3_1.TagObject | OpenAPIV3_1.OperationObject | OpenAPIV3_1.ParameterBaseObject>(oae: T, cb?: (docs: JSDocStructure) => void) {
	let txt = makeJsDocTxt('title' in oae ? oae.title : ('summary' in oae ? oae.summary : undefined), oae.description);
	let docs = <JSDocStructure>{
		kind: StructureKind.JSDoc,
		description: txt?.trim()
	};
	if ('externalDocs' in oae && oae.externalDocs) {
		txt = undefined;
		if (oae.externalDocs.url) {
			if (oae.externalDocs.description)
				txt = oae.externalDocs.url + '\t' + oae.externalDocs.description;
			else
				txt = oae.externalDocs.url;
		}
		else if (oae.externalDocs.description)
			txt = oae.externalDocs.description;
		if (txt)
			docs.tags = [{
				kind: StructureKind.JSDocTag,
				tagName: 'link',
				text: txt.trim()
			}];
	}
	if (cb)
		cb(docs);
	if (docs.description || docs.tags?.length > 0)
		return docs;
	return undefined;
}

export class CannotGenerateError extends Error {
	static Name = 'CannotGenerate';

	constructor(message?: string, options?: ErrorOptions) {
		super(message, options);
		this.name = CannotGenerateError.Name;
	}
}

export function oae2ObjLiteralStr(oae: OpenAPIV3_1.SchemaObject, verbose: boolean, cb: (dependent: TsmorphModel) => void) {
	const seen = new Set<TsmorphModel>();
	const schemaVarNames: Record<string, string> = {};
	const initTemplate = JSON5.stringify(oae, (key, value) => {
		if (key === '') {
			if (!value.description)
				if (value.summary)
					value.description = value.summary;
			delete value.summary;
		}
		if (key === '$schema')
			return undefined;
		if (key === '$ast')
			return undefined;
		if (key === 'example' || key === 'examples')
			return undefined;
		if (key.toLowerCase().startsWith('x-'))
			return undefined;
		if (key === 'summary')
			return undefined;
		if (key === 'description' && !verbose)
			return undefined;
		if (value && value[CodeGenAst] && isTsmorphModel(value[CodeGenAst]) && (!seen.has(value[CodeGenAst]))) {
			const model = value[CodeGenAst];
			seen.add(model);
			if (isIdentifiedLangNeutral(model)) {
				const varName = model.getIdentifier('json');
				schemaVarNames[varName] = varName;
				cb(model);
				// It is inconceivable that a REST api would contain these doublet values, so we will use them as lodash template delimiters.
				// But the ugly secret is that json5 will *escape* our delimiters, and quote our string.
				return `\x07\x13 ${varName} \x11\x07`;
			}
		}
		return value;
	}, '\t');
	// Remember, the json will *escape* the non-printable delimiters we used above.
	const templateFn = lodashTemplate(initTemplate, {interpolate: /'\\x07\\x13 (.+?) \\x11\\x07'/g});
	return templateFn(schemaVarNames);
}
