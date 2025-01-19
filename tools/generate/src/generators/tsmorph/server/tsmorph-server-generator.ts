import {Inject, Injectable} from 'async-injection';
import {lstatSync, mkdirSync} from 'fs';
import {writeFile} from 'fs/promises';
import path from 'node:path';
import {BaseSettingsToken, BaseSettingsType} from 'oag-shared/lang-neutral/settings';
import {safeLStatSync} from 'oag-shared/utils/misc-utils';
import {Project, SourceFile} from 'ts-morph';
import {TsMorphSettingsToken, TsMorphSettingsType} from '../../../settings/tsmorph';
import {CodeGenAst, SourceGenerator} from '../../source-generator';
import {TempFileName} from '../oag-tsmorph';
import {isTsmorphModel} from '../tsmorph-model';

@Injectable()
export class TsmorphServerGenerator implements SourceGenerator {
	constructor(@Inject(BaseSettingsToken) protected readonly baseSettings: BaseSettingsType, @Inject(TsMorphSettingsToken) protected readonly tsmorphSettings: TsMorphSettingsType) {
	}

	async generate(ast: CodeGenAst): Promise<void> {
		this.tsmorphSettings.project.compilerOptions.outDir = this.baseSettings.outputDirectory;
		this.project = new Project(this.tsmorphSettings.project);
		this.tempFile = this.project.createSourceFile(TempFileName, '', {overwrite: true});
		// Generate all the models
		//TODO: Remove the console.log and the sort, as they  are only used for manual comparison of regression
		for (let m of ast.models.sort((a, b) => a.name.localeCompare(b.name))) {
			console.log(m.toString());
			if (isTsmorphModel(m)) {
				// The tempFile is really just access to the project, as models at this level typically create their own files.
				await m.generate(this.tempFile);
			}
		}
		ast.apis.forEach(m => {
			console.log(m.toString());
		});
		// Remove the temp file
		this.tempFile.deleteImmediatelySync();
		delete this.tempFile;
		// Format and write all remaining project files to disk.
		for (const file of this.project.getSourceFiles()) {
			//TODO: Enable optimizations once we have completed the manual regressions (see above).

			// file.organizeImports(this.tsmorphSettings.format);
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
}
