import {Injectable, InjectionToken} from 'async-injection';
import {Api, Model} from 'oag-shared/lang-neutral';

export interface CodeGenAst {
	models: Model[],
	apis: Api[]
}

export interface SourceGenerator {
	generate(ast: CodeGenAst): Promise<void>;
}

export const SourceGeneratorToken = new InjectionToken<SourceGenerator>('source-generator');

@Injectable()
export class DefaultSourceGenerator implements SourceGenerator {
	constructor() {
	}

	async generate(ast: CodeGenAst): Promise<void> {
		ast.models.reverse().forEach(m => {
			console.log(m.toString());
		});
		ast.apis.forEach(m => {
			console.log(m.toString());
		});
	}
}
