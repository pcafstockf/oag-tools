import {Inject} from 'async-injection';
import {lstatSync, mkdirSync, readFileSync} from 'fs';
import {writeFile} from 'fs/promises';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {BaseSettingsToken, BaseSettingsType} from 'oag-shared/lang-neutral/settings';
import {interpolateBashStyle, safeLStatSync} from 'oag-shared/utils/misc-utils';
import {ModuleResolutionKind, Node, Project, SourceFile} from 'ts-morph';
import {TsMorphSettingsToken, TsMorphSettingsType} from '../../settings/tsmorph';
import {CodeGenAst, SourceGenerator} from '../source-generator';
import {TempFileName} from './oag-tsmorph';
import {isTsmorphApi} from './tsmorph-api';
import {isTsmorphModel} from './tsmorph-model';
import {supportManifest} from '../../support-manifest';

export class TsmorphGenerator implements SourceGenerator {
	constructor(
		@Inject(BaseSettingsToken) protected readonly baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken) protected readonly tsmorphSettings: TsMorphSettingsType
	) {
	}

	async generate(ast: CodeGenAst): Promise<void> {
		this.tsmorphSettings.project.compilerOptions.outDir = this.baseSettings.outputDirectory;
		this.project = new Project(this.tsmorphSettings.project);
		this.tempFile = this.project.createSourceFile(TempFileName, '', {overwrite: true});

		await this.preGenerate(ast);

		const q = [] as Promise<void>[];
		for (let m of ast.models) {
			console.log(m.toString());
			if (isTsmorphModel(m))
				q.push(m.generate(this.tempFile));
		}
		await Promise.all(q);

		for (let a of ast.apis) {
			console.log(a.toString());
			if (isTsmorphApi(a))
				await a.generate(this.tempFile);
		}

		await this.postGenerate(ast, undefined);

		// Remove the temp file
		this.tempFile.deleteImmediatelySync();
		delete this.tempFile;
		// Format and write all project files to disk.
		for (const file of this.project.getSourceFiles()) {
			file.organizeImports(this.tsmorphSettings.format);
			file.formatText(this.tsmorphSettings.format);
			const fp = file.getFilePath();
			const parentDir = path.dirname(fp);
			let stat = safeLStatSync(parentDir);
			if (!stat) {
				mkdirSync(parentDir, {recursive: true});
				stat = lstatSync(parentDir);
			}
			if (!stat.isDirectory())
				throw new Error('Invalid output directory for generated file: ' + fp);
			await writeFile(fp, file.getFullText(), 'utf8');
		}
		// If isolatedModules is enabled, create a fresh resolver project from the written files
		// with NodeJs module resolution to accurately determine and fix type-only imports.
		if (this.tsmorphSettings.project.compilerOptions?.isolatedModules) {
			const resolverProject = new Project({
				compilerOptions: {
					...this.tsmorphSettings.project.compilerOptions,
					moduleResolution: ModuleResolutionKind.NodeJs
				}
			});
			resolverProject.addSourceFilesAtPaths(path.join(this.baseSettings.outputDirectory, '**/*.ts'));
			for (const file of resolverProject.getSourceFiles()) {
				const origText = file.getFullText();
				this.fixTypeOnlyImports(file);
				if (file.getFullText() !== origText)
					await writeFile(file.getFilePath(), file.getFullText(), 'utf8');
			}
		}
	}

	protected project: Project;
	protected tempFile: SourceFile;

	protected async preGenerate(_ast: CodeGenAst): Promise<void> {
	}

	/**
	 * When isolatedModules is enabled, TypeScript requires type-only imports to use 'import type' syntax.
	 * This method post-processes a source file's imports, resolving each named import to its original
	 * declaration to determine whether it is a type (interface/type alias) or a value (class/const/function/enum).
	 */
	protected fixTypeOnlyImports(file: SourceFile): void {
		for (const imp of file.getImportDeclarations()) {
			if (imp.isTypeOnly())
				continue;
			const namedImports = imp.getNamedImports();
			if (namedImports.length === 0)
				continue;
			const typeFlags: boolean[] = namedImports.map(ni => {
				if (ni.isTypeOnly())
					return true;
				const sym = ni.getSymbol();
				const aliased = sym?.getAliasedSymbol?.() ?? sym;
				if (!aliased)
					return false; // Can't resolve — assume value (safe default)
				const decls = aliased.getDeclarations();
				return decls.length > 0 && decls.every(d => Node.isInterfaceDeclaration(d) || Node.isTypeAliasDeclaration(d));
			});
			const allTypes = typeFlags.every(f => f);
			const allValues = typeFlags.every(f => !f);
			if (allTypes) {
				imp.setIsTypeOnly(true);
			}
			else if (!allValues) {
				// Mixed: mark individual type-only specifiers
				namedImports.forEach((ni, i) => {
					if (typeFlags[i])
						ni.setIsTypeOnly(true);
				});
			}
		}
	}

	protected async postGenerate(_ast: CodeGenAst, target?: string): Promise<void> {
		if (!safeLStatSync(this.baseSettings.outputDirectory))
			mkdirSync(this.baseSettings.outputDirectory, {recursive: true});
		this.tsmorphSettings.support.forEach(entry => {
			let dstBase: string;
			const opts = {
				role: `.${this.baseSettings.role}`,
				target: `.${target}`
			};
			entry.files.forEach((fp: object | string) => {
				if (typeof fp === 'object') {
					const key = Object.keys(fp)[0];
					fp = interpolateBashStyle((fp as any)[key], opts);    // Default to none
					dstBase = path.basename(key);
				}
				else {
					fp = interpolateBashStyle(fp, opts);    // Default to none
					dstBase = path.basename(fp);
				}
				const dstPath = path.join(this.baseSettings.outputDirectory, dstBase);
				if (!safeLStatSync(dstPath)) {
					// Try embedded manifest first
					const key = supportManifest.makeKeyFromSrc(entry.srcDirName, fp as string);
					const content = key ? supportManifest.get(key) : undefined;
					if (typeof content === 'string') {
						writeFileSync(dstPath, content, 'utf8');
					}
					else {
						// Fallback to filesystem for non-bundled dev runs
						const srcFilePath = path.normalize(path.join(entry.srcDirName, fp as string));
						if (safeLStatSync(srcFilePath)) {
							const srcTxt = readFileSync(srcFilePath, 'utf-8');
							writeFileSync(dstPath, srcTxt);
						}
					}
				}
			});
		});
	}
}
