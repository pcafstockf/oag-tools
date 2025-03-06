import {Inject, Injectable} from 'async-injection';
import {mkdirSync, readFileSync} from 'fs';
import {template as lodashTemplate} from 'lodash';
import * as fs from 'node:fs';
import {writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {FileBasedLangNeutral, isFileBasedLangNeutral} from 'oag-shared/lang-neutral/lang-neutral';
import {BaseSettingsToken, BaseSettingsType} from 'oag-shared/lang-neutral/settings';
import {interpolateBashStyle, safeLStatSync} from 'oag-shared/utils/misc-utils';
import {SourceFile, VariableDeclarationKind} from 'ts-morph';
import {TsMorphSettingsToken, TsMorphSettingsType} from '../../../settings/tsmorph';
import {TsMorphClientSettingsToken, TsMorphClientSettingsType} from '../../../settings/tsmorph-client';
import {CodeGenAst} from '../../source-generator';
import {importIfNotSameFile} from '../oag-tsmorph';
import {isTsmorphApi} from '../tsmorph-api';
import {TsmorphGenerator} from '../tsmorph-generator';
import {isTsmorphModel} from '../tsmorph-model';

@Injectable()
export class TsmorphClientGenerator extends TsmorphGenerator {
	constructor(
		@Inject(BaseSettingsToken) baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken) tsmorphSettings: TsMorphSettingsType,
		@Inject(TsMorphClientSettingsToken) protected readonly tsmorphClientSettings: TsMorphClientSettingsType
	) {
		super(baseSettings, tsmorphSettings);
	}

	protected async preGenerate(_ast: CodeGenAst): Promise<void> {
		let srcTxt: string;
		let dstPath: string;
		const internalDir = path.normalize(path.join(this.baseSettings.outputDirectory, this.baseSettings.apiIntfDir, this.tsmorphClientSettings.internalDirName));
		mkdirSync(internalDir, {recursive: true});
		this.tsmorphClientSettings.support.forEach(entry => {
			let dstBase: string;
			const opts = {
				role: this.baseSettings.role ? `.${this.baseSettings.role}` : '',
				target: this.baseSettings.target ? `.${this.baseSettings.target}` : '',
				httpsup: this.tsmorphClientSettings.httpsup ? `.${this.tsmorphClientSettings.httpsup}` : '',
			};
			entry.files.forEach(fp => {
				if (typeof fp === 'object') {
					const key = Object.keys(fp)[0];
					fp = interpolateBashStyle((fp as any)[key], opts);    // Default to none
					dstBase = path.basename(key);
				}
				else {
					fp = interpolateBashStyle(fp, opts);    // Default to none
					dstBase = path.basename(fp);
				}
				const srcFilePath = path.normalize(path.join(entry.srcDirName, fp));
				if (safeLStatSync(srcFilePath)) {
					dstPath = path.join(internalDir, dstBase);
					if (!safeLStatSync(dstPath)) {
						srcTxt = readFileSync(srcFilePath, 'utf-8');
						writeFileSync(dstPath, srcTxt);
					}
				}
			});
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
		const supportDir = path.resolve(path.join(this.baseSettings.outputDirectory, this.baseSettings.apiIntfDir), this.tsmorphClientSettings.internalDirName);
		let dmSf: SourceFile;
		let dmSfPath = path.join(supportDir, 'data-mocking.ts');
		if (this.baseSettings.apiMockDir && this.baseSettings.modelJsonDir && this.tsmorphClientSettings.mocklib)
			dmSf = this.project.addSourceFileAtPath(dmSfPath);
		else
			fs.rmSync(dmSfPath);
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
				moduleSpecifier: this.tsmorphClientSettings.internalDirName,
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
			// Add an injection token for the MockDataGenerator.
			if (dmSf) {
				const mdgIntf = dmSf.getInterface('MockDataGenerator');
				di.intfImport?.forEach(i => dmSf.addImportDeclaration(i));
				di.apiIntfTokens?.forEach(tok => {
					let varName = interpolateBashStyle(tok.name_Tmpl, {intfName: mdgIntf.getName()});
					let varInitializer = interpolateBashStyle(tok.initializer_Tmpl || '', {intfName: mdgIntf.getName(), intfLabel: mdgIntf.getName(), varName: varName});
					dmSf.addVariableStatement({
						declarationKind: VariableDeclarationKind.Const,
						isExported: true,
						declarations: [{
							name: varName,
							initializer: varInitializer ? varInitializer : undefined
						}]
					});
				});
			}
		}
	}
}
