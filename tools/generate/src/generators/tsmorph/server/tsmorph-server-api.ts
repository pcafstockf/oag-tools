import {Inject, Injectable} from 'async-injection';
import path from 'node:path';
import {LangNeutralApiTypes} from 'oag-shared/lang-neutral/api';
import {BaseSettingsToken, BaseSettingsType} from 'oag-shared/lang-neutral/base';
import {interpolateBashStyle} from 'oag-shared/utils/misc-utils';
import {ClassDeclaration, FunctionDeclaration, Identifier, InterfaceDeclaration, Scope, SourceFile, VariableDeclarationKind} from 'ts-morph';
import {TsMorphSettingsToken, TsMorphSettingsType} from '../../../settings/tsmorph';
import {TsMorphServerSettingsToken, TsMorphServerSettingsType} from '../../../settings/tsmorph-server';
import {bindAst} from '../oag-tsmorph';
import {ApiClassDeclaration, BaseTsmorphApi, TsmorphApi} from '../tsmorph-api';
import {isTsmorphMethod} from '../tsmorph-method';
import {TsmorphServerMethodType} from './tsmorph-server-method';

export interface TsmorphServerApiType extends TsmorphApi<ApiClassDeclaration, ApiClassDeclaration> {
	getLangNode(type: 'intf'): ApiClassDeclaration;

	getLangNode(type: 'impl'): ApiClassDeclaration;

	getLangNode(type: 'hndl'): ApiFunctionDeclaration;

	getTypeNode(ln?: Readonly<ApiClassDeclaration | ApiFunctionDeclaration>): BoundTypeNode;
}

export interface ApiFunctionDeclaration extends FunctionDeclaration {
	readonly $ast?: TsmorphServerApiType;
}

type BoundTypeNode = Identifier & { readonly $ast: TsmorphServerApiType };
type LangNeutralServerApiTypes = Extract<LangNeutralApiTypes, 'intf' | 'impl' | 'hndl'>;

@Injectable()
export class TsmorphServerApi extends BaseTsmorphApi<ApiClassDeclaration> implements TsmorphServerApiType {
	constructor(
		@Inject(BaseSettingsToken)
		baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken)
		tsMorphSettings: TsMorphSettingsType,
		@Inject(TsMorphServerSettingsToken)
		protected tsMorphServerSettings: TsMorphServerSettingsType
	) {
		super(baseSettings, tsMorphSettings);
		this.#tsTypes = {} as any;
	}

	readonly #tsTypes: {
		hndl: FunctionDeclaration
	};

	protected ensureInternalDirImport(decl: InterfaceDeclaration | ClassDeclaration) {
		const sf = decl.getSourceFile();
		sf.addImportDeclaration({
			moduleSpecifier: this.tsMorphServerSettings.internalDirName,
			namedImports: ['HttpResponse']
		});
		const intfDir = path.relative(path.join(this.baseSettings.outputDirectory, this.baseSettings.apiImplDir), path.join(this.baseSettings.outputDirectory, this.baseSettings.apiIntfDir));
		const intDir = path.relative(intfDir, this.tsMorphServerSettings.internalDirName);
		const framework = this.tsMorphServerSettings[this.tsMorphServerSettings.framework];
		framework.context.imphorts.map(i => {
			return {
				moduleSpecifier: interpolateBashStyle(i.moduleSpecifier, {internal: intDir}),
				namedImports: i.namedImports
			};
		}).forEach(i => sf.addImportDeclaration(i));
	}

	getTypeNode(ln?: Readonly<ApiClassDeclaration | ApiFunctionDeclaration>): BoundTypeNode {
		return super.getTypeNode(ln as ApiClassDeclaration) as BoundTypeNode;
	}

	getLangNode(alnType: 'intf'): ApiClassDeclaration;
	getLangNode(alnType: 'impl'): ApiClassDeclaration;
	getLangNode(alnType: 'hndl'): ApiFunctionDeclaration;
	getLangNode(alnType: LangNeutralServerApiTypes): ApiClassDeclaration | ApiFunctionDeclaration {
		if (alnType === 'hndl')
			return this.#tsTypes[alnType];
		return super.getLangNode(alnType as any);
	}

	bind(alnType: 'intf', ast: Omit<ApiClassDeclaration, '$ast'>): ApiClassDeclaration;
	bind(alnType: 'impl', ast: Omit<ApiClassDeclaration, '$ast'>): ApiClassDeclaration;
	bind(alnType: 'hndl', ast: Omit<ApiFunctionDeclaration, '$ast'>): ApiFunctionDeclaration;
	bind(alnType: LangNeutralServerApiTypes, ast: Omit<ApiClassDeclaration, '$ast'> | Omit<ApiFunctionDeclaration, '$ast'>): ApiClassDeclaration | ApiFunctionDeclaration {
		switch (alnType) {
			case 'hndl':
				return this.#tsTypes[alnType] = bindAst(ast as any, this);
			case 'impl':
				return super.bind(alnType, ast as any);
			case 'intf':
				return super.bind(alnType, ast as any);
		}
	}

	async generate(sf: SourceFile): Promise<void> {
		await super.generate(sf);

		if (!this.getLangNode('hndl')) {
			sf = await this.getSrcFile('hndl', sf.getProject(), sf);
			if (sf) {
				const id = this.ensureIdentifier('hndl');
				let hndl = this.findHndl(sf, id) as ApiFunctionDeclaration;
				if (!hndl) {
					hndl = this.bind('hndl', this.createHndl(sf, id));
					this.importInto(sf, 'intf');
					this.dependencies.forEach(d => d.importInto(sf, 'intf'));

					for (let m of this.methods) {
						if (isTsmorphMethod(m))
							await (m as TsmorphServerMethodType).generate('hndl', hndl);
					}
				}
				if (hndl && !hndl.$ast)
					this.bind('hndl', hndl);
			}
		}
	}

	protected findIntf(sf: SourceFile, id: string): ClassDeclaration {
		return sf.getClass(id);
	}

	protected createIntf(sf: SourceFile, id: string): ClassDeclaration {
		let retVal = sf.addClass({
			name: id,
			isAbstract: true,
			isExported: true
		});
		this.ensureInternalDirImport(retVal);
		this.makeIntfConstructor(retVal);
		const di = this.tsMorphServerSettings.dependencyInjection ? this.tsMorphServerSettings.di[this.tsMorphServerSettings.dependencyInjection] : undefined;
		if (di) {
			di.intfImport?.forEach(i => sf.addImportDeclaration(i));
			di.apiIntfTokens?.forEach(tok => {
				let varName = interpolateBashStyle(tok.name_Tmpl, {intfName: retVal.getName(), oaeName: this.oae.name});
				let varInitializer = interpolateBashStyle(tok.initializer_Tmpl || '', {intfName: retVal.getName(), intfLabel: retVal.getName(), oaeName: this.oae.name, varName: varName});
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

	protected makeIntfConstructor(c: ClassDeclaration) {
		const i = c.addConstructor({
			scope: Scope.Protected,
		});
	}

	protected findImpl(sf: SourceFile, id: string): ClassDeclaration {
		return sf.getClass(id);
	}

	protected createImpl(sf: SourceFile, id: string): ClassDeclaration {
		const intf = this.getLangNode('intf');
		let retVal = sf.addClass({
			name: id,
			isExported: true,
			extends: intf.getName()
		});
		this.importInto(sf, 'intf');
		this.ensureInternalDirImport(retVal);
		const di = this.tsMorphServerSettings.dependencyInjection ? this.tsMorphServerSettings.di[this.tsMorphServerSettings.dependencyInjection] : undefined;
		if (di) {
			di.apiConstruction.implDecorator.forEach(d => {
				retVal.addDecorator(d);
			});
			di.implImport?.forEach(i => sf.addImportDeclaration(i));
			if (di.apiIntfTokens) {
				const intfName = this.getLangNode('intf').getName();
				const apiImportDecl = sf.getImportDeclaration(c => !!c.getNamedImports().find(i => i.getName() === intfName));
				di.apiIntfTokens?.forEach(tok => {
					let varName = interpolateBashStyle(tok.name_Tmpl, {intfName: intfName});
					apiImportDecl.addNamedImport(varName);
				});
			}
		}
		this.makeImplConstructor(retVal);
		return retVal;
	}

	protected makeImplConstructor(c: ClassDeclaration) {
		c.addConstructor({
			statements: 'super();'
		});
	}

	protected findHndl(sf: SourceFile, id: string): FunctionDeclaration {
		return sf.getFunction(id);
	}

	protected createHndl(sf: SourceFile, id: string): FunctionDeclaration {
		const framework = this.tsMorphServerSettings[this.tsMorphServerSettings.framework];
		const intf = this.getLangNode('intf');
		sf.addImportDeclaration({
			moduleSpecifier: this.tsMorphServerSettings.internalDirName,
			namedImports: ['FrameworkUtils', 'FrameworkStorageCtx']
		});
		const fn = sf.addFunction({
			name: id,
			isExported: true,
			parameters: [{
				name: 'utils',
				type: 'FrameworkUtils',
			}, {
				name: 'storage',
				type: 'FrameworkStorageCtx'
			}, {
				name: 'api',
				type: intf.getName(),
			}]
		});
		const cast = framework.hndl.cast ? ` as unknown as ${framework.hndl.cast}` : '';
		fn.setBodyText(`return {}${cast};`);
		return fn;
	}
}
