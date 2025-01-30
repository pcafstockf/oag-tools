import {Inject, Injectable} from 'async-injection';
import {findLastIndex} from 'lodash';
import {BaseSettingsToken, BaseSettingsType} from 'oag-shared/lang-neutral/base';
import {interpolateBashStyle} from 'oag-shared/utils/misc-utils';
import {ClassDeclaration, InterfaceDeclaration, Node, Scope, SourceFile, SyntaxKind, VariableDeclarationKind} from 'ts-morph';
import {TsMorphSettingsToken, TsMorphSettingsType} from '../../../settings/tsmorph';
import {TsMorphClientSettingsToken, TsMorphClientSettingsType} from '../../../settings/tsmorph-client';
import {BaseTsmorphApi} from '../tsmorph-api';

@Injectable()
export class TsmorphClientApi extends BaseTsmorphApi {
	constructor(
		@Inject(BaseSettingsToken)
			baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken)
			tsMorphSettings: TsMorphSettingsType,
		@Inject(TsMorphClientSettingsToken)
		protected tsmorphClientSettings: TsMorphClientSettingsType
	) {
		super(baseSettings, tsMorphSettings);
	}

	async generate(sf: SourceFile): Promise<void> {
		await super.generate(sf);
	}

	protected createIntf(sf: SourceFile, id: string): InterfaceDeclaration {
		const retVal = super.createIntf(sf, id);
		this.ensureInternalDirImport(retVal);

		const di = this.tsmorphClientSettings.dependencyInjection ? this.tsmorphClientSettings.di[this.tsmorphClientSettings.dependencyInjection] : undefined;
		if (di) {
			// Each API interface should define a DI token that the API implementation will be bound to
			di.intfImport.forEach(i => sf.addImportDeclaration(i));
			di.apiIntfTokens?.forEach(tok => {
				let varName = interpolateBashStyle(tok.name_Tmpl, {intfName: retVal.getName(), oaeName: this.name});
				let varInitializer = interpolateBashStyle(tok.initializer_Tmpl || '', {intfName: retVal.getName(), intfLabel: retVal.getName(), oaeName: this.name, varName: varName});
				sf.addVariableStatement({
					declarationKind: VariableDeclarationKind.Const,
					isExported: true,
					declarations: [{
						name: varName,
						initializer: varInitializer ? varInitializer : undefined
					}]
				});
			});
		}
		return retVal;
	}

	protected createImpl(sf: SourceFile, id: string): ClassDeclaration {
		const retVal = super.createImpl(sf, id);
		this.ensureInternalDirImport(retVal);
		const di = this.tsmorphClientSettings.dependencyInjection ? this.tsmorphClientSettings.di[this.tsmorphClientSettings.dependencyInjection] : undefined;
		if (di) {
			di.implImport?.forEach(i => sf.addImportDeclaration(i));
			if (di.apiIntfTokens) {
				const intfName = this.getLangNode('intf').getName();
				const apiImportDecl = sf.getImportDeclaration(c => !!c.getNamedImports().find(i => i.getName() === intfName));
				di.apiIntfTokens?.forEach(tok => {
					let varName = interpolateBashStyle(tok.name_Tmpl, {intfName: intfName});
					apiImportDecl.addNamedImport(varName);
				});
			}
			di.apiConstruction.implDecorator.forEach(d => {
				retVal.addDecorator(d);
			});
			const idx = findLastIndex(sf.getStatements(), (n: any) => {
				return n.isKind(SyntaxKind.ImportDeclaration);
			});
			di.apiImplTokens?.forEach(tok => {
				let varName = interpolateBashStyle(tok.name_Tmpl, {implName: retVal.getName()});
				let varInitializer = interpolateBashStyle(tok.initializer_Tmpl || '', {intfLabel: retVal.getName()});
				sf.insertVariableStatement(idx + 1, {
					declarationKind: VariableDeclarationKind.Const,
					isExported: true,
					declarations: [{
						name: varName,
						initializer: varInitializer ? varInitializer : undefined
					}]
				});
			});
		}
		this.makeConstructor(retVal);
		return retVal;
	}

	protected makeConstructor(c: ClassDeclaration) {
		const impl = c.addConstructor({
			parameters: [
				{name: 'http', type: 'HttpClient', isReadonly: true, scope: Scope.Protected},
				{name: 'config', type: 'ApiClientConfig', isReadonly: true, scope: Scope.Protected}
			]
		});
		const di = this.tsmorphClientSettings.dependencyInjection ? this.tsmorphClientSettings.di[this.tsmorphClientSettings.dependencyInjection] : undefined;
		if (di?.apiConstruction) {
			const params = impl.getParameters();
			di.apiConstruction.httpClientInject?.forEach((d => {
				params[0].addDecorator(d);
			}));
			di.apiConstruction.apiConfigInject?.forEach((d => {
				params[1].addDecorator({
					name: d.name,
					arguments: d.arguments.map(a => interpolateBashStyle(a, {implName: c.getName()}))
				});
			}));
		}
		impl.setBodyText((writer) => {
			if (c.getExtends())
				writer.writeLine('super();');
			writer.writeLine('this.config = this.config || {}');
		});
	}

	protected ensureInternalDirImport(decl: InterfaceDeclaration | ClassDeclaration) {
		const imports = ['HttpResponse', 'ApiClientConfig'];
		if (Node.isClassDeclaration(decl)) {
			imports.push('HttpClient');
			imports.push('HttpOptions');
			if (this.tsmorphClientSettings.dependencyInjection)
				imports.push('ApiHttpClientToken');
		}
		decl.getSourceFile().addImportDeclaration({
			moduleSpecifier: this.tsmorphClientSettings.support.dstDirName,
			namedImports: imports
		});
	}
}
