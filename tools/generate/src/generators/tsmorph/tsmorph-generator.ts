import {Inject} from 'async-injection';
import {lstatSync, mkdirSync} from 'fs';
import {writeFile} from 'fs/promises';
import path from 'node:path';
import {BaseSettingsToken, BaseSettingsType} from 'oag-shared/lang-neutral/settings';
import {safeLStatSync} from 'oag-shared/utils/misc-utils';
import {Project, SourceFile} from 'ts-morph';
import {TsMorphSettingsToken, TsMorphSettingsType} from '../../settings/tsmorph';
import {CodeGenAst, SourceGenerator} from '../source-generator';
import {TempFileName} from './oag-tsmorph';
import {isTsmorphApi} from './tsmorph-api';
import {isTsmorphModel} from './tsmorph-model';

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

		//TODO: Remove the console.log and the sort, as they  are only used for manual comparison of regression
		for (let m of ast.models.sort((a, b) => a.name.localeCompare(b.name))) {
			console.log(m.toString());
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

	}

	protected async postGenerate(ast: CodeGenAst): Promise<void> {

	}
}
