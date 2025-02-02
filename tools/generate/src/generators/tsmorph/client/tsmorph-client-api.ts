import {Inject, Injectable} from 'async-injection';
import {findLastIndex} from 'lodash';
import {LangNeutralApiTypes} from 'oag-shared/lang-neutral/api';
import {BaseSettingsToken, BaseSettingsType} from 'oag-shared/lang-neutral/base';
import {interpolateBashStyle} from 'oag-shared/utils/misc-utils';
import {ClassDeclaration, Identifier, InterfaceDeclaration, Node, Scope, SourceFile, SyntaxKind, VariableDeclarationKind} from 'ts-morph';
import {TsMorphSettingsToken, TsMorphSettingsType} from '../../../settings/tsmorph';
import {TsMorphClientSettingsToken, TsMorphClientSettingsType} from '../../../settings/tsmorph-client';
import {bindAst} from '../oag-tsmorph';
import {ApiClassDeclaration, ApiInterfaceDeclaration, BaseTsmorphApi, TsmorphApi} from '../tsmorph-api';

export interface TsmorphClientApiType extends TsmorphApi<ApiInterfaceDeclaration, ApiClassDeclaration> {
	getLangNode(type: 'intf'): ApiInterfaceDeclaration;

	getLangNode(type: 'impl'): ApiClassDeclaration;

	getLangNode(type: 'mock'): ApiClassDeclaration;

	getTypeNode(ln?: Readonly<ApiClassDeclaration>): BoundTypeNode;
}

type LangNeutralClientApiTypes = Extract<LangNeutralApiTypes, 'intf' | 'impl' | 'mock'>;
type BoundTypeNode = Identifier & { readonly $ast: TsmorphClientApiType };

@Injectable()
export class TsmorphClientApi extends BaseTsmorphApi<ApiInterfaceDeclaration, ApiClassDeclaration> implements TsmorphClientApiType {
	constructor(
		@Inject(BaseSettingsToken)
			baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken)
			tsMorphSettings: TsMorphSettingsType,
		@Inject(TsMorphClientSettingsToken)
		protected tsmorphClientSettings: TsMorphClientSettingsType
	) {
		super(baseSettings, tsMorphSettings);
		this.#tsTypes = {} as any;
	}

	readonly #tsTypes: {
		mock: ApiClassDeclaration
	};

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

	getTypeNode(ln?: Readonly<ApiInterfaceDeclaration | ApiClassDeclaration>): BoundTypeNode {
		return super.getTypeNode(ln as ApiClassDeclaration) as BoundTypeNode;
	}

	getLangNode(alnType: 'intf'): ApiInterfaceDeclaration;
	getLangNode(alnType: 'impl'): ApiClassDeclaration;
	getLangNode(alnType: 'mock'): ApiClassDeclaration;
	getLangNode(alnType: LangNeutralClientApiTypes): ApiInterfaceDeclaration | ApiClassDeclaration {
		if (alnType === 'mock')
			return this.#tsTypes[alnType];
		return super.getLangNode(alnType as any);
	}

	bind(alnType: 'intf', ast: Omit<ApiInterfaceDeclaration, '$ast'>): ApiInterfaceDeclaration;
	bind(alnType: 'impl', ast: Omit<ApiClassDeclaration, '$ast'>): ApiClassDeclaration;
	bind(alnType: 'mock', ast: Omit<ApiClassDeclaration, '$ast'>): ApiClassDeclaration;
	bind(alnType: LangNeutralClientApiTypes, ast: Omit<ApiInterfaceDeclaration, '$ast'> | Omit<ApiClassDeclaration, '$ast'>): ApiInterfaceDeclaration | ApiClassDeclaration {
		switch (alnType) {
			case 'mock':
				return this.#tsTypes[alnType] = bindAst(ast as any, this);
			case 'impl':
				return super.bind(alnType, ast as any);
			case 'intf':
				return super.bind(alnType, ast as any);
		}
	}

	protected findIntf(sf: SourceFile, id: string): InterfaceDeclaration {
		return sf.getInterface(id);
	}
	protected createIntf(sf: SourceFile, id: string): InterfaceDeclaration {
		let retVal = sf.addInterface({
			name: id,
			isExported: true
		});
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

	protected findImpl(sf: SourceFile, id: string): ClassDeclaration {
		return sf.getClass(id);
	}
	protected createImpl(sf: SourceFile, id: string): ClassDeclaration {
		const intf = this.getLangNode('intf');
		let retVal = sf.addClass({
			name: id,
			isExported: true,
			implements: [intf.getName()]
		});
		this.importInto(sf, 'intf');
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
		this.makeImplConstructor(retVal);
		return retVal;
	}

	protected makeImplConstructor(c: ClassDeclaration) {
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
}
