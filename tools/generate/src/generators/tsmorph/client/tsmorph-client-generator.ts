import {Inject, Injectable} from 'async-injection';
import {lstatSync, mkdirSync, readFileSync} from 'fs';
import {writeFile} from 'fs/promises';
import {template as lodashTemplate} from 'lodash';
import {writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {FileBasedLangNeutral, isFileBasedLangNeutral} from 'oag-shared/lang-neutral/lang-neutral';
import {BaseSettingsToken, BaseSettingsType} from 'oag-shared/lang-neutral/settings';
import {interpolateBashStyle, safeLStatSync} from 'oag-shared/utils/misc-utils';
import {Project, SourceFile} from 'ts-morph';
import {TsMorphSettingsToken, TsMorphSettingsType} from '../../../settings/tsmorph';
import {TsMorphClientSettingsToken, TsMorphClientSettingsType} from '../../../settings/tsmorph-client';
import {CodeGenAst, SourceGenerator} from '../../source-generator';
import {importIfNotSameFile, TempFileName} from '../oag-tsmorph';
import {isTsmorphApi} from '../tsmorph-api';
import {isTsmorphModel} from '../tsmorph-model';

@Injectable()
export class TsmorphClientGenerator implements SourceGenerator {
	constructor(
		@Inject(BaseSettingsToken) protected readonly baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken) protected readonly tsmorphSettings: TsMorphSettingsType,
		@Inject(TsMorphClientSettingsToken) protected readonly tsmorphClientSettings: TsMorphClientSettingsType
	) {
	}

	async generate(ast: CodeGenAst): Promise<void> {
		this.tsmorphSettings.project.compilerOptions.outDir = this.baseSettings.outputDirectory;
		this.project = new Project(this.tsmorphSettings.project);
		this.tempFile = this.project.createSourceFile(TempFileName, '', {overwrite: true});

		await this.preGenerate(ast);

		// Generate all the models
		//TODO: Remove the console.log and the sort, as they  are only used for manual comparison of regression
		for (let m of ast.models.sort((a, b) => a.name.localeCompare(b.name))) {
			if (isTsmorphModel(m))
				await m.generate(this.tempFile);
		}
		for (let a of ast.apis.sort((a, b) => a.name.localeCompare(b.name))) {
			console.log(a.toString());
			if (isTsmorphApi(a))
				await a.generate(this.tempFile);
		}

		await this.postGenerate(ast);

		// Remove the temp file
		this.tempFile.deleteImmediatelySync();
		delete this.tempFile;
		// Format and write all remaining project files to disk.
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
			await writeFile(file.getFilePath(), file.getFullText(), 'utf8');
		}
	}

	protected project: Project;
	protected tempFile: SourceFile;

	protected async preGenerate(ast: CodeGenAst): Promise<void> {
		let srcTxt: string;
		let dstPath: string;
		const internalDir = path.normalize(path.join(this.baseSettings.outputDirectory, this.baseSettings.apiIntfDir, this.tsmorphClientSettings.support.dstDirName));
		mkdirSync(internalDir, {recursive: true});
		this.tsmorphClientSettings.support.files.forEach(fp => {
			let dstBase: string;
			const opts = {
				target: this.baseSettings.target ? `.${this.baseSettings.target}` : ''
			};
			if (typeof fp === 'object') {
				const key = Object.keys(fp)[0];
				fp = interpolateBashStyle((fp as any)[key], opts);    // Default to none
				dstBase = path.basename(key);
			}
			else {
				fp = interpolateBashStyle(fp, opts);    // Default to none
				dstBase = path.basename(fp);
			}
			const srcFilePath = path.normalize(path.join(this.tsmorphClientSettings.support.srcDirName, fp));
			dstPath = path.join(internalDir, dstBase);
			if (!safeLStatSync(dstPath)) {
				srcTxt = readFileSync(srcFilePath, 'utf-8');
				writeFileSync(dstPath, srcTxt);
			}
		});
	}

	protected async postGenerate(ast: CodeGenAst): Promise<void> {
		// Generate the apis index.ts file.
		const apiIndexTs = ast.apis.filter(a => isTsmorphApi(a) && isFileBasedLangNeutral(a)).reduce((p, a) => {
			const filePath = path.basename(a.getFilepath('intf'));
			p += `export * from './${path.basename(filePath, path.extname(filePath))}';${os.EOL}`;
			return p;
		}, ``);
		if (apiIndexTs)
			this.project.createSourceFile(path.join(this.baseSettings.outputDirectory, this.baseSettings.apiIntfDir, 'index.ts'), apiIndexTs, {overwrite: true});
		// Generate the models index.ts file.
		const modelIndexTs = ast.models.filter(m => isTsmorphModel(m) && isFileBasedLangNeutral(m)).reduce((p, m) => {
			const filePath = (m as unknown as FileBasedLangNeutral).getFilepath('intf');
			p += `export * from './${path.basename(filePath, path.extname(filePath))}';${os.EOL}`;
			return p;
		}, ``);
		if (modelIndexTs)
			this.project.createSourceFile(path.join(this.baseSettings.outputDirectory, this.baseSettings.modelIntfDir, 'index.ts'), modelIndexTs, {overwrite: true});
		// If we Dependency Injection is requested, generate a setup.ts file in the services directory
		const di = this.tsmorphClientSettings.dependencyInjection ? this.tsmorphClientSettings.di[this.tsmorphClientSettings.dependencyInjection] : undefined;
		if (di) {
			const intfTokensExt = di.apiIntfTokens.map(i => interpolateBashStyle(i.name_Tmpl, {intfName: ''}));
			const confTokensExt = di.apiImplTokens.map(i => interpolateBashStyle(i.name_Tmpl, {implName: ''}));
			const setupTemplate = lodashTemplate(di.apiSetup);
			const setupTxt = setupTemplate({
				intfTokensExt,
				confTokensExt,
				apis: ast.apis.filter(a => isTsmorphApi(a))
			}).trim();
			const diSetupSf = this.project.createSourceFile(path.join(this.baseSettings.outputDirectory, this.baseSettings.apiImplDir, 'setup.ts'), setupTxt, {overwrite: true});
			// To difficult for the template to know where the interfaces are, so we import those ourselves.
			const imports = ['HttpClient as ApiHttpClient', 'ApiHttpClientToken', 'ApiClientConfig'];
			diSetupSf.addImportDeclaration({
				moduleSpecifier: this.tsmorphClientSettings.support.dstDirName,
				namedImports: imports
			});
			ast.apis.forEach((api) => {
				if (isTsmorphApi(api)) {
					const intf = api.getLangNode('intf');
					const impl = api.getLangNode('impl');
					const intfImport = importIfNotSameFile(diSetupSf, intf, intf.getName());
					intfTokensExt.forEach(ext => intfImport.addNamedImport(intf.getName() + ext));
					const implImport = importIfNotSameFile(diSetupSf, impl, impl.getName());
					confTokensExt.forEach(ext => implImport.addNamedImport(impl.getName() + ext));
				}
			});
		}
	}
}
