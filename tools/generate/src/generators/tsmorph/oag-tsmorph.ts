import {randomUUID} from 'crypto';
import path from 'node:path';
import {LangNeutral} from 'oag-shared/lang-neutral';
import * as nameUtils from 'oag-shared/utils/name-utils';
import {Node, SourceFile} from 'ts-morph';

export const TempFileName = '_$temp-File.ts';

/**
 * Associate a CodeGenAst with a tsmorph Node.
 * @param obj
 * @param ast
 */
export function bindAst<T extends Node = Node, A = LangNeutral>(obj: Omit<T, '$ast'>, ast: A): T {
	if (obj && (!obj.hasOwnProperty('$ast')))
		Object.defineProperty(obj, '$ast', {
			get() {
				return ast;
			}
		});
	return obj as T;
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
