import path from 'node:path';
import {LangNeutralApiTypes} from 'oag-shared/lang-neutral/api';
import {Api, BaseApi, BaseSettingsType} from 'oag-shared/lang-neutral/base';
import {isFileBasedLangNeutral, isOpenApiLangNeutral} from 'oag-shared/lang-neutral/lang-neutral';
import {safeLStatSync} from 'oag-shared/utils/misc-utils';
import {OpenAPIV3_1} from 'openapi-types';
import {ClassDeclaration, ExportableNode, Identifier, InterfaceDeclaration, Node, Project, SourceFile} from 'ts-morph';
import {TsMorphSettingsType} from '../../settings/tsmorph';
import {bindAst, importIfNotSameFile, makeJsDoc} from './oag-tsmorph';
import {isTsmorphMethod} from './tsmorph-method';
import {isTsmorphModel, TsmorphModel} from './tsmorph-model';
import {isTsmorphParameter} from './tsmorph-parameter';
import {isTsmorphResponse} from './tsmorph-response';

export interface TsmorphApi extends Api {
	getLangNode(type: 'intf'): ApiInterfaceDeclaration;

	getLangNode(type: 'impl' | 'hndl' | 'mock'): ApiClassDeclaration;

	getTypeNode(ln?: Readonly<ApiInterfaceDeclaration | ApiClassDeclaration>): Identifier & { readonly $ast: TsmorphModel };

	importInto(sf: SourceFile, alnType?: LangNeutralApiTypes): void;

	generate(sf: SourceFile): Promise<void>;
}

export class BaseTsmorphApi extends BaseApi implements TsmorphApi {
	protected constructor(baseSettings: BaseSettingsType, protected readonly tsMorphSettings: TsMorphSettingsType) {
		super(baseSettings);
		this.#tsTypes = {} as any;
		this.#dependencies = [];
	}

	readonly #tsTypes: {
		intf: ApiInterfaceDeclaration,
		impl: ApiClassDeclaration,
		hndl: ApiClassDeclaration
		mock: ApiClassDeclaration
	};
	readonly #dependencies: TsmorphModel[];

	get dependencies(): ReadonlyArray<TsmorphModel> {
		return this.#dependencies;
	}

	getTypeNode(ln?: Readonly<ApiInterfaceDeclaration | ApiClassDeclaration>): Identifier & { readonly $ast: TsmorphModel } {
		throw new Error('Bad internal logic');
	}

	getLangNode(type: 'intf'): ApiInterfaceDeclaration;
	getLangNode(type: 'impl'): ApiClassDeclaration;
	getLangNode(type: 'hndl'): ApiClassDeclaration;
	getLangNode(type: 'mock'): ApiClassDeclaration;
	getLangNode(type: LangNeutralApiTypes): ApiInterfaceDeclaration | ApiClassDeclaration {
		return this.#tsTypes[type];
	}

	bind(alnType: 'intf', ast: Omit<ApiInterfaceDeclaration, '$ast'>): ApiInterfaceDeclaration;
	bind(alnType: 'impl', ast: Omit<ApiClassDeclaration, '$ast'>): ApiClassDeclaration;
	bind(alnType: 'hndl', ast: Omit<ApiClassDeclaration, '$ast'>): ApiClassDeclaration;
	bind(alnType: 'mock', ast: Omit<ApiClassDeclaration, '$ast'>): ApiClassDeclaration;
	bind(alnType: LangNeutralApiTypes, ast: Omit<ApiInterfaceDeclaration, '$ast'> | Omit<ApiClassDeclaration, '$ast'>): ApiInterfaceDeclaration | ApiClassDeclaration {
		this.#tsTypes[alnType] = bindAst(ast as any, this) as any;
		return this.#tsTypes[alnType];
	}

	importInto(sf: SourceFile, alnType?: LangNeutralApiTypes): void {
		let t: Identifier;
		let ex: Node;
		switch (alnType) {
			case 'intf':
				t = this.getTypeNode(this.getLangNode(alnType));
				ex = t?.getParent();
				break;
			case 'impl':
				t = this.getTypeNode(this.getLangNode(alnType));
				ex = t?.getParent();
				break;
			case 'hndl':
				t = this.getTypeNode(this.getLangNode(alnType));
				ex = t?.getParent();
				break;
			case 'mock':
				t = this.getTypeNode(this.getLangNode(alnType));
				ex = t?.getParent();
				break;
			default:
				t = this.getTypeNode();
				ex = t?.getParent();
				break;
		}
		if (t) {
			if (ex && Node.isExportable(ex) && ex.isExported())
				importIfNotSameFile(sf, t, t.getText());
		}
	}

	protected async getSrcFile(alnType: LangNeutralApiTypes, proj: Project, sf?: SourceFile): Promise<SourceFile> {
		if (alnType && isFileBasedLangNeutral(this)) {
			const fp = this.getFilepath(alnType);
			if (fp) {
				const fullPath = path.join(proj.getCompilerOptions().outDir, fp) + '.ts';
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
		if (!this.getLangNode('intf')) {
			sf = await this.getSrcFile('intf', sf.getProject(), sf);
			if (sf) {
				const id = this.ensureIdentifier('intf');
				let intf: ApiInterfaceDeclaration = sf.getInterface(id);
				if (!intf)
					intf = this.bind('intf', this.createIntf(sf, id));
				else if (!intf.$ast)
					intf = this.bind('intf', intf);
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
		}
	}

	protected createIntf(sf: SourceFile, id: string): InterfaceDeclaration {
		let retVal = sf.addInterface({
			name: id,
			isExported: true
		});
		return retVal;
	}
}

export function isTsmorphApi(obj: any): obj is TsmorphApi {
	if (obj)
		if (obj instanceof BaseTsmorphApi)
			return true;
	return false;
}


export interface ApiInterfaceDeclaration extends InterfaceDeclaration {
	readonly $ast?: BaseTsmorphApi;
}

export interface ApiClassDeclaration extends ClassDeclaration {
	readonly $ast?: BaseTsmorphApi;
}
