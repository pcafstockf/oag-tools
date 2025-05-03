import path from 'node:path';
import {LangNeutralApiTypes} from 'oag-shared/lang-neutral/api';
import {Api, BaseApi, BaseSettingsType} from 'oag-shared/lang-neutral/base';
import {isFileBasedLangNeutral, isOpenApiLangNeutral} from 'oag-shared/lang-neutral/lang-neutral';
import {safeLStatSync} from 'oag-shared/utils/misc-utils';
import {OpenAPIV3_1} from 'openapi-types';
import {ClassDeclaration, ExportableNode, Identifier, InterfaceDeclaration, JSDocStructure, Node, Project, PropertyDeclaration, SourceFile, StructureKind} from 'ts-morph';
import {TsMorphSettingsType} from '../../settings/tsmorph';
import {bindAst, importIfNotSameFile, makeJsDoc} from './oag-tsmorph';
import {isTsmorphMethod} from './tsmorph-method';
import {isTsmorphModel, TsmorphModel} from './tsmorph-model';
import {isTsmorphParameter} from './tsmorph-parameter';
import {isTsmorphResponse} from './tsmorph-response';

type BoundTypeNode<INTF extends ApiInterfaceDeclaration | ApiClassDeclaration, IMPL extends ApiClassDeclaration> = Identifier & { readonly $ast: TsmorphApi<INTF, IMPL> };

export interface TsmorphApi<INTF extends ApiInterfaceDeclaration | ApiClassDeclaration, IMPL extends ApiClassDeclaration> extends Api {
	getLangNode(type: 'intf'): INTF;

	getLangNode(type: 'impl'): IMPL;

	getTypeNode(ln?: Readonly<INTF | IMPL>): BoundTypeNode<INTF, IMPL>;

	importInto(sf: SourceFile, alnType?: LangNeutralApiTypes): void;

	generate(sf: SourceFile): Promise<void>;
}

export abstract class BaseTsmorphApi<INTF extends ApiInterfaceDeclaration | ApiClassDeclaration> extends BaseApi implements TsmorphApi<INTF, ApiClassDeclaration> {
	protected constructor(baseSettings: BaseSettingsType, protected readonly tsMorphSettings: TsMorphSettingsType) {
		super(baseSettings);
		this.#tsTypes = {} as any;
		this.#dependencies = [];
	}

	readonly #tsTypes: {
		intf: INTF,
		impl: ApiClassDeclaration
	};

	protected ensureIdentifier(type: LangNeutralApiTypes) {
		let identifier = this.getIdentifier(type);
		if (identifier) {
			// If we are not generating for this type, then by definition, the identifier is fake.
			switch (type) {
				case 'intf':
					if (isTsmorphApi(this))
						if (this.baseSettings.apiIntfDir)
							return identifier;
					break;
				case 'impl':
					if (isTsmorphApi(this))
						if (this.baseSettings.apiImplDir)
							return identifier;
					break;
				case 'hndl':
					if (isTsmorphApi(this))
						if (this.baseSettings.apiHndlDir)
							return identifier;
					break;
				case 'mock':
					if (isTsmorphApi(this))
						if (this.baseSettings.apiMockDir)
							return identifier;
					break;
				default:
					break;
			}
			return undefined;
		}
	}

	get dependencies(): ReadonlyArray<TsmorphModel> {
		return this.#dependencies;
	}

	readonly #dependencies: TsmorphModel[];

	protected addDependency(dependent: TsmorphModel): void {
		const t = dependent.getTypeNode();
		if (t && Node.isExportable(t.getParent()) && (t.getParent() as unknown as ExportableNode).isExported()) {
			if (!this.#dependencies.find(d => Object.is(d, dependent)))
				this.#dependencies.push(dependent);
		}
		else {
			// If the dependent is not exportable, then we need to depend on what it depends on.
			(dependent as unknown as this).dependencies.forEach(md => {
				if (!this.#dependencies.find(d => Object.is(d, md)))
					this.#dependencies.push(dependent);
			});
		}
	}

	protected async getSrcFile(alnType: LangNeutralApiTypes, proj: Project, sf?: SourceFile): Promise<SourceFile> {
		if (alnType && isFileBasedLangNeutral(this)) {
			const fp = this.getFilepath(alnType);
			if (fp) {
				const fullPath = path.join(proj.getCompilerOptions().outDir, fp);
				// Can be configured to only generate api-impl if non-existent
				if (alnType === 'impl' && this.baseSettings.role === 'server' && safeLStatSync(fp))
					return Promise.resolve(null);
				sf = proj.getSourceFile(fullPath);
				if (!sf)
					sf = proj.createSourceFile(fullPath, '', {overwrite: false});
			}
			if (sf)
				return sf;
		}
		return undefined;
	}

	getFilepath(type: LangNeutralApiTypes): string {
		const result = super.getFilepath(type);
		if (result)
			return result + '.ts';
		return result;
	}

	importInto(sf: SourceFile, alnType?: LangNeutralApiTypes): void {
		const t = this.getTypeNode(this.getLangNode(alnType || 'intf' as any));
		if (t)
			importIfNotSameFile(sf, t, t.getText());
	}

	getTypeNode(ln?: Readonly<INTF | ApiClassDeclaration>): BoundTypeNode<INTF, ApiClassDeclaration> {
		if (!ln)
			ln = this.getLangNode('intf');
		return bindAst(ln.getNameNode() as any, this);
	}

	getLangNode(alnType: 'intf'): INTF;
	getLangNode(alnType: 'impl'): ApiClassDeclaration;
	getLangNode(alnType: 'intf' | 'impl'): INTF | ApiClassDeclaration {
		return this.#tsTypes[alnType];
	}

	bind(alnType: 'intf', ast: Omit<INTF, '$ast'>): INTF;
	bind(alnType: 'impl', ast: Omit<ApiClassDeclaration, '$ast'>): ApiClassDeclaration;
	bind(alnType: 'intf' | 'impl', ast: Omit<INTF, '$ast'> | Omit<ApiClassDeclaration, '$ast'>): INTF | ApiClassDeclaration {
		return this.#tsTypes[alnType] = bindAst(ast as any, this);
	}

	async generate(sf: SourceFile): Promise<void> {
		// First ensure all the models we require are generated based on the SourceFile we've been given.
		for (let m of this.methods) {
			if (isTsmorphMethod(m)) {
				for (let p of m.parameters) {
					if (isTsmorphParameter(p))
						if (isTsmorphModel(p.model)) {
							await p.model.generate(sf);
							this.addDependency(p.model);
						}
				}
				for (let [_, r] of m.responses) {
					if (isTsmorphResponse(r))
						if (isTsmorphModel(r.model)) {
							await r.model.generate(sf);
							this.addDependency(r.model);
						}
				}
			}
		}
		if (!this.getLangNode('intf') && this.baseSettings.apiIntfDir) {
			sf = await this.getSrcFile('intf', sf.getProject(), sf);
			if (sf) {
				const id = this.ensureIdentifier('intf');
				let intf = this.findIntf(sf, id) as INTF;
				if (!intf) {
					intf = this.bind('intf', this.createIntf(sf, id));
					if (this.baseSettings.emitDescriptions) {
						if (isOpenApiLangNeutral<OpenAPIV3_1.TagObject, Api>(this)) {
							const docs = makeJsDoc(this.oae);
							if (docs)
								intf.addJsDoc(docs);
						}
					}
					this.dependencies.forEach(d => d.importInto(sf, 'intf'));

					for (let m of this.methods) {
						if (isTsmorphMethod(m))
							await m.generate('intf', intf);
					}
				}
				if (intf && !intf.$ast)
					this.bind('intf', intf);
			}
		}
		if (!this.getLangNode('impl') && this.baseSettings.apiImplDir) {
			sf = await this.getSrcFile('impl', sf.getProject(), sf);
			if (sf) {
				const id = this.ensureIdentifier('impl');
				let impl = this.findImpl(sf, id) as ApiClassDeclaration;
				if (!impl) {
					impl = this.bind('impl', this.createImpl(sf, id));
					if (this.baseSettings.emitDescriptions) {
						impl.addJsDoc(<JSDocStructure>{
							kind: StructureKind.JSDoc,
							tags: [{
								kind: StructureKind.JSDocTag,
								tagName: 'inheritDoc'
							}]
						});
					}
					if (this.getLangNode('intf')) {
						this.importInto(sf, 'intf');
						this.dependencies.forEach(d => d.importInto(sf, 'intf'));
					}
					else
						this.dependencies.forEach(d => d.importInto(sf, 'impl'));

					for (let m of this.methods) {
						if (isTsmorphMethod(m))
							await m.generate('impl', impl);
					}
				}
				if (impl && !impl.$ast)
					this.bind('impl', impl);
			}
		}
	}

	protected abstract findIntf(sf: SourceFile, id: string): Omit<INTF, '$ast'>;

	protected abstract createIntf(sf: SourceFile, id: string): INTF;

	protected abstract findImpl(sf: SourceFile, id: string): Omit<ApiClassDeclaration, '$ast'>;

	protected abstract createImpl(sf: SourceFile, id: string): ApiClassDeclaration;
}

export function isTsmorphApi(obj: any): obj is TsmorphApi<any, any> {
	if (obj)
		if (obj instanceof BaseTsmorphApi)
			return true;
	return false;
}


export interface ApiInterfaceDeclaration extends InterfaceDeclaration {
	readonly $ast?: TsmorphApi<ApiInterfaceDeclaration, ApiClassDeclaration>;
}

export interface ApiClassDeclaration extends ClassDeclaration {
	readonly $ast?: TsmorphApi<ApiInterfaceDeclaration | ApiClassDeclaration, ApiClassDeclaration>;
}

export interface ApiPropertyDeclaration extends PropertyDeclaration {
	readonly $ast?: TsmorphApi<ApiInterfaceDeclaration | ApiClassDeclaration, ApiClassDeclaration>;
}
