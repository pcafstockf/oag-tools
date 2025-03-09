import {Inject, Injectable} from 'async-injection';
import {mkdirSync, readFileSync} from 'fs';
import {template as lodashTemplate} from 'lodash';
import {writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {FileBasedLangNeutral, isFileBasedLangNeutral} from 'oag-shared/lang-neutral/lang-neutral';
import {BaseSettingsToken, BaseSettingsType} from 'oag-shared/lang-neutral/settings';
import {interpolateBashStyle, safeLStatSync} from 'oag-shared/utils/misc-utils';
import {VariableDeclarationKind} from 'ts-morph';
import {TsMorphSettingsToken, TsMorphSettingsType} from '../../../settings/tsmorph';
import {TsMorphServerSettingsToken, TsMorphServerSettingsType} from '../../../settings/tsmorph-server';
import {CodeGenAst} from '../../source-generator';
import {importIfNotSameFile} from '../oag-tsmorph';
import {isTsmorphApi} from '../tsmorph-api';
import {TsmorphGenerator} from '../tsmorph-generator';
import {isTsmorphModel} from '../tsmorph-model';

@Injectable()
export class TsmorphServerGenerator extends TsmorphGenerator {
	constructor(
		@Inject(BaseSettingsToken) baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken) tsmorphSettings: TsMorphSettingsType,
		@Inject(TsMorphServerSettingsToken) protected readonly tsmorphServerSettings: TsMorphServerSettingsType
	) {
		super(baseSettings, tsmorphSettings);
	}

	protected async preGenerate(_ast: CodeGenAst): Promise<void> {
		await super.preGenerate(_ast);

		this.tsmorphServerSettings.support.forEach(entry => {
			let dstPath: string;
			let srcFilePath: string;
			let srcTxt: string;
			const internalDir = path.normalize(path.join(this.baseSettings.outputDirectory, this.baseSettings.apiIntfDir, this.tsmorphServerSettings.internalDirName));
			mkdirSync(internalDir, {recursive: true});
			entry.files.forEach(fp => {
				let dstBase: string;
				if (typeof fp === 'object') {
					const key = Object.keys(fp)[0];
					fp = interpolateBashStyle((fp as any)[key], {framework: this.tsmorphServerSettings.framework});
					dstBase = path.basename(key);
				}
				else {
					fp = interpolateBashStyle(fp, {framework: this.tsmorphServerSettings.framework});
					dstBase = path.basename(fp);
				}
				srcFilePath = path.normalize(path.join(entry.srcDirName, fp));
				dstPath = path.join(internalDir, dstBase);
				if (!safeLStatSync(dstPath)) {
					srcTxt = readFileSync(srcFilePath, 'utf-8');
					writeFileSync(dstPath, srcTxt);
				}
			});
		});
	}

	protected async postGenerate(ast: CodeGenAst, target?: string): Promise<void> {
		await super.postGenerate(ast, this.tsmorphServerSettings.framework);

		// Generate the handler index.ts file.
		const hndlIndexTs = ast.apis.filter(a => isTsmorphApi(a) && isFileBasedLangNeutral(a)).reduce((p, a) => {
			const filePath = path.basename(a.getFilepath('hndl'));
			p += `export * from './${path.basename(filePath, path.extname(filePath))}';${os.EOL}`;
			return p;
		}, ``);
		if (hndlIndexTs)
			this.project.createSourceFile(path.join(this.baseSettings.outputDirectory, this.baseSettings.apiHndlDir, 'index.ts'), hndlIndexTs, {overwrite: true});
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

		const di = this.tsmorphServerSettings.dependencyInjection ? this.tsmorphServerSettings.di[this.tsmorphServerSettings.dependencyInjection] : undefined;
		if (di) {
			const intfTokensExt = di.apiIntfTokens.map(i => interpolateBashStyle(i.name_Tmpl, {intfName: ''}));
			const setupTemplate = lodashTemplate(di.apiSetup);
			const setupTxt = setupTemplate({
				intfTokensExt,
				apis: ast.apis.filter(a => isTsmorphApi(a))
			}).trim();
			const diSetupSf = this.project.createSourceFile(path.join(this.baseSettings.outputDirectory, this.baseSettings.apiImplDir, 'setup.ts'), setupTxt, {overwrite: true});
			ast.apis.forEach((api) => {
				if (isTsmorphApi(api)) {
					const intf = api.getLangNode('intf');
					const impl = api.getLangNode('impl');
					const intfImport = importIfNotSameFile(diSetupSf, intf, intf.getName());
					intfTokensExt.forEach(ext => intfImport.addNamedImport(intf.getName() + ext));
					importIfNotSameFile(diSetupSf, impl, impl.getName());
				}
			});
			// Add an injection token for the MockDataGenerator.
			const supportDir = path.resolve(path.join(this.baseSettings.outputDirectory, this.baseSettings.apiIntfDir), this.tsmorphServerSettings.internalDirName);
			const dmSf = this.project.addSourceFileAtPath(path.join(supportDir, 'data-mocking.ts'));
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
