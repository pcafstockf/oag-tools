import {Inject, Injectable} from 'async-injection';
import {stringify as json5Stringify} from 'json5';
import {template as lodashTemplate} from 'lodash';
import os from 'node:os';
import path from 'node:path';
import {Model} from 'oag-shared/lang-neutral';
import {BaseArrayModel, BasePrimitiveModel, BaseRecordModel, BaseSettingsToken, BaseSettingsType, BaseTypedModel, BaseUnionModel, CodeGenAst} from 'oag-shared/lang-neutral/base';
import {BaseModel} from 'oag-shared/lang-neutral/base/base-model';
import {isFileBasedLangNeutral, isIdentifiedLangNeutral} from 'oag-shared/lang-neutral/lang-neutral';
import {isArrayModel, isPrimitiveModel, isRecordModel, isSchemaModel, isTypedModel, isUnionModel, LangNeutralModelTypes} from 'oag-shared/lang-neutral/model';
import {safeLStatSync} from 'oag-shared/utils/misc-utils';
import * as nameUtils from 'oag-shared/utils/name-utils';
import {ClassDeclaration, EnumDeclaration, ExportableNode, Identifier, InterfaceDeclaration, JSDocableNode, JSDocStructure, Node, ObjectLiteralElement, Project, SourceFile, StructureKind, ts, TypeAliasDeclaration, TypeLiteralNode, TypeNode, TypeReferenceNode, VariableDeclarationKind, VariableStatement} from 'ts-morph';
import {TsMorphSettingsToken, TsMorphSettingsType} from '../../settings/tsmorph';
import {bindAst, importIfNotSameFile, makeFakeIdentifier, TempFileName} from './oag-tsmorph';
import SyntaxKind = ts.SyntaxKind;

interface ModelInterfaceDeclaration extends InterfaceDeclaration {
	readonly $ast?: TsmorphModel<InterfaceDeclaration | ClassDeclaration | ObjectLiteralElement>;
}

interface ModelClassDeclaration extends ClassDeclaration {
	readonly $ast?: TsmorphModel<InterfaceDeclaration | ClassDeclaration | ObjectLiteralElement>;
}

interface ModelVariableStatement extends VariableStatement {
	readonly $ast?: TsmorphModel<InterfaceDeclaration | ClassDeclaration | ObjectLiteralElement>;
}

interface ModelEnumDeclaration extends EnumDeclaration {
	readonly $ast?: TsmorphModel;
}

interface ModelTypeAliasDeclaration extends TypeAliasDeclaration {
	readonly $ast?: TsmorphModel;
}

type BoundTypeNode = (TypeNode & { readonly $ast: TsmorphModel }) | (Identifier & { readonly $ast: TsmorphModel } & Node) | undefined;
type BoundJsonNode = (Identifier & { readonly $ast: TsmorphModel } & Node) | undefined;

/**
 * All methods of this interface MUST be idempotent.
 */
export interface TsmorphModel<I extends Node = Node, C extends Node | void = Node> extends Model {
	generate(sf: SourceFile): Promise<void>;

	getLangNode(mlnType: 'intf'): Readonly<I>;

	getLangNode(mlnType: 'impl'): Readonly<C>;

	getLangNode(mlnType: 'json'): Readonly<ModelVariableStatement>;

	getTypeNode(ln?: Readonly<I | C>): BoundTypeNode;

	getJsonNode(): BoundJsonNode;

	importInto(sf: SourceFile, mlnType?: LangNeutralModelTypes): void;
}

export function isTsmorphModel(obj: any): obj is TsmorphModel {
	if (obj)
		if (typeof (obj as Model).getLangNode === 'function')
			if (typeof obj.tsMorphSettings === 'object' && obj.tsMorphSettings)
				if (typeof obj.generate === 'function')
					if (typeof obj.makeJsDoc === 'function')
						if (typeof obj.getSrcFile === 'function')
							if (typeof obj.bind === 'function')
								return true;
	return false;
}

function MixTsmorphModel<T extends BaseModel, I extends Node = Node, C extends Node | void = Node>(base: any) {
	//@ts-ignore
	const derived = class extends base implements TsmorphModel<I, C> {
		constructor(baseSettings: BaseSettingsType, readonly tsMorphSettings: TsMorphSettingsType) {
			super(baseSettings);
			this.#tsTypes = {} as any;
			this.#dependencies = [];
		}
		readonly #tsTypes: {
			intf: I,
			impl: C,
			json: VariableStatement
		};
		#fakeName: string | undefined;

		get dependencies(): ReadonlyArray<TsmorphModel> {
			return this.#dependencies;
		}

		readonly #dependencies: TsmorphModel[];

		getLangNode(mlnType: 'intf'): I;
		getLangNode(mlnType: 'impl'): C;
		getLangNode(mlnType: 'json'): ModelVariableStatement;
		getLangNode(mlnType: LangNeutralModelTypes): I | C | ModelVariableStatement | undefined {
			return this.#tsTypes[mlnType];
		}

		/**
		 * By wrapping 'bindAst' we not only perform the binding, but we set our own reference, so that once this call is done, the binding is bidirectional.
		 * This is important for nested generation calls.
		 */
		bind(mlnType: 'intf', ast: Omit<I, '$ast'>): I;
		bind(mlnType: 'impl', ast: Omit<C, '$ast'>): C;
		bind(mlnType: 'json', ast: Omit<ModelVariableStatement, '$ast'>): ModelVariableStatement;
		bind(mlnType: LangNeutralModelTypes, ast: Omit<I, '$ast'> | Omit<C, '$ast'> | Omit<ModelVariableStatement, '$ast'>): I | C | ModelVariableStatement {
			this.#tsTypes[mlnType] = bindAst(ast as any, this) as any;
			return this.#tsTypes[mlnType];
		}

		getTypeNode(ln?: I | C): BoundTypeNode {
			throw new Error('Bad internal logic');
		}

		getJsonNode(): BoundJsonNode {
			if (isIdentifiedLangNeutral(this)) {
				const n = this.getLangNode('json');
				if (n)
					return bindAst<Identifier, TsmorphModel>(n.getFirstDescendantByKind(SyntaxKind.VariableDeclaration)?.getNameNode() as Identifier, this as unknown as TsmorphModel);
			}
			return undefined;
		}

		protected async genJson(sf: SourceFile): Promise<void> {
			if (this.baseSettings.modelJsonDir && !this.getLangNode('json')) {
				if (isSchemaModel(this) && isFileBasedLangNeutral(this)) {
					const {id, fake} = this.ensureIdentifier('json');
					sf = await this.getSrcFile('json', sf.getProject(), sf);
					if (sf) {
						let retVal: ModelVariableStatement = sf.getVariableStatement(id);
						if (!retVal) {
							const oae = this.oae;
							const schemaVarNames: Record<string, string> = {};
							const initTemplate = json5Stringify(oae, (key, value) => {
								if (key === '') {
									if (!value.description)
										if (value.summary)
											value.description = value.summary;
									delete value.summary;
								}
								if (key === '$schema')
									return undefined;
								if (key === '$ast')
									return undefined;
								if (key.toLowerCase().startsWith('x-'))
									return undefined;
								if (key === 'summary')
									return undefined;
								if (key === 'description' && isTsmorphModel(this) && (!this.baseSettings.verboseJsonSchema))
									return undefined;
								if (value[CodeGenAst] && (!Object.is(value[CodeGenAst], this))) {
									const model = value[CodeGenAst] as TsmorphModel & this;
									if (isIdentifiedLangNeutral(model)) {
										const varName = model.getIdentifier('json');
										schemaVarNames[varName] = varName;
										this.addDependency(model);
										// It is inconceivable that a REST api would contain these doublet values, so we will use them as lodash template delimiters.
										// But the ugly secret is that json5 will *escape* our delimiters, and quote our string.
										return `\x07\x13 ${varName} \x11\x07`;
									}
								}
								return value;
							}, '\t');
							// Remember, the json will *escape* the non-printable delimiters we used above.
							const templateFn = lodashTemplate(initTemplate, {interpolate: /'\\x07\\x13 (.+?) \\x11\\x07'/g});
							retVal = this.bind('json', sf.addVariableStatement({
								declarationKind: VariableDeclarationKind.Const,
								isExported: true,
								declarations: [{
									name: id,
									initializer: templateFn(schemaVarNames)
								}]
							}));
							if (isTsmorphModel(this) && !fake && this.baseSettings.emitDescriptions && (!this.baseSettings.verboseJsonSchema)) {
								const docs = this.makeJsDoc();
								if (docs)
									retVal.addJsDoc(docs);
							}
						}
						else if (!retVal.$ast)
							this.bind('json', retVal);
						this.dependencies.forEach(d => d.importInto(sf, 'json'));
					}
				}
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

		importInto(sf: SourceFile, mlnType?: LangNeutralModelTypes) {
			let t: BoundTypeNode | BoundJsonNode;
			let ex: Node;
			switch (mlnType) {
				case 'json':
					t = this.getJsonNode();
					ex = t?.getFirstAncestorByKind(SyntaxKind.VariableStatement);
					break;
				case 'intf':
					t = this.getTypeNode(this.getLangNode(mlnType));
					ex = t?.getParent();
					break;
				case 'impl':
					t = this.getTypeNode(this.getLangNode(mlnType));
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
				else
					this.dependencies.forEach(d => d.importInto(sf));
			}
		}

		makeJsDoc() {
			if (isSchemaModel(this)) {
				const oae = this.oae;
				let txt: string;
				if (oae.description) {
					if (oae.title && oae.description.toLowerCase().startsWith(oae.title.toLowerCase()))
						txt = oae.description;
					else if (oae.title)
						txt = oae.title + os.EOL + oae.description;
					else
						txt = oae.description;
				}
				else if (oae.title)
					txt = oae.title;
				let docs = <JSDocStructure>{
					kind: StructureKind.JSDoc,
					description: txt?.trim()
				};
				if (oae.externalDocs) {
					txt = undefined;
					if (oae.externalDocs.url) {
						if (oae.externalDocs.description)
							txt = oae.externalDocs.url + '\t' + oae.externalDocs.description;
						else
							txt = oae.externalDocs.url;
					}
					else if (oae.externalDocs.description)
						txt = oae.externalDocs.description;
					if (txt)
						docs.tags.push({
							kind: StructureKind.JSDocTag,
							tagName: 'link',
							text: txt.trim()
						});
				}
				if (docs.description || docs.tags?.length > 0)
					return docs;

			}
			return undefined;
		}

		protected async getSrcFile(mlnType: LangNeutralModelTypes, proj: Project, sf?: SourceFile): Promise<SourceFile> {
			if (mlnType && isFileBasedLangNeutral(this)) {
				const fp = this.getFilepath(mlnType);
				if (fp) {
					const fullPath = path.join(proj.getCompilerOptions().outDir, fp) + '.ts';
					// Can be configured to only generate api-impl if non-existent
					if (mlnType === 'impl' && this.baseSettings.role === 'server' && safeLStatSync(fp))
						return Promise.resolve(null);
					sf = proj.getSourceFile(fullPath);
					if (!sf)
						sf = proj.createSourceFile(fullPath, '', {overwrite: false});
				}
				if (sf)
					return sf;
			}
			return proj.getSourceFile(`${TempFileName}`);
		}

		protected ensureIdentifier(type: LangNeutralModelTypes) {
			let isIdentifier: boolean;
			let identifier: string;
			if (isIdentifiedLangNeutral(this)) {
				isIdentifier = true;
				identifier = this.getIdentifier(type);
				if (identifier) {
					// If we are not generating for this type, then by definition, the identifier is fake.
					switch (type) {
						case 'intf':
							if (isTsmorphModel(this))
								if (!this.baseSettings.modelIntfDir)
									isIdentifier = false;
							break;
						case 'impl':
							if (isTsmorphModel(this))
								if (!this.baseSettings.modelImplDir)
									isIdentifier = false;
							break;
						case 'json':
							if (isTsmorphModel(this))
								if (!this.baseSettings.modelJsonDir)
									isIdentifier = false;
							break;
						default:
							break;
					}
				}
			}
			if (!identifier) {
				isIdentifier = false;
				if (!this.#fakeName)
					this.#fakeName = makeFakeIdentifier();
				identifier = this.#fakeName;
			}
			return {
				id: identifier,
				fake: !isIdentifier
			};
		}
	};
	return derived as new (baseSettings: BaseSettingsType, tsMorphSettings: TsMorphSettingsType) => T & typeof derived.prototype & TsmorphModel<I, C>;
}

/**
 * A union can never be a class (only a type alias).
 */
export class TsmorphUnionModel extends MixTsmorphModel<BaseUnionModel, ModelTypeAliasDeclaration, void>(BaseUnionModel as any) {
	constructor(
		baseSettings: BaseSettingsType,
		tsMorphSettings: TsMorphSettingsType
	) {
		super(baseSettings, tsMorphSettings);
	}

	override getTypeNode(ln?: ModelTypeAliasDeclaration): BoundTypeNode {
		const n = ln ?? this.getLangNode('intf');
		if (n && Node.isTypeAliasDeclaration(n)) {
			if (n.isExported())
				return bindAst(n.getNameNode(), this);
			return bindAst(n.getTypeNode(), this);
		}
		return undefined;
	}

	override async generate(sf: SourceFile): Promise<void> {
		if (!this.getLangNode('intf') && this.baseSettings.modelIntfDir) {
			sf = await this.getSrcFile('intf', sf.getProject(), sf);
			if (sf) {
				const {id, fake} = this.ensureIdentifier('intf');
				const typeAlias: ModelTypeAliasDeclaration = sf.getTypeAlias(id);
				if (!typeAlias)
					this.bind('intf', await this.createTypeAlias(sf, id, fake));
				else if (!typeAlias.$ast)
					this.bind('intf', typeAlias);
			}
		}
		if (!this.getLangNode('json'))
			await this.genJson(sf);
	}

	private async createTypeAlias(sf: SourceFile, id: string, fake: boolean): Promise<TypeAliasDeclaration> {
		let types: Node[] = [];
		for (let u of this.unionOf) {
			if (isTsmorphModel(u)) {
				await u.generate(sf);
				let propType = u.getTypeNode();
				types.push(propType);
				this.addDependency(u);
			}
		}
		const typeTxt = types.map(t => t.getText());
		const retVal = sf.addTypeAlias({
			name: id,
			isExported: !fake,
			type: typeTxt.join(' | ')
		});
		if (this.baseSettings.emitDescriptions && !fake) {
			const docs = this.makeJsDoc();
			if (docs)
				retVal.addJsDoc(docs);
		}
		return retVal;
	}
}

@Injectable()
export class TsmorphPrimitiveModel extends MixTsmorphModel<BasePrimitiveModel, Node<ts.NamedDeclaration>, ModelClassDeclaration>(BasePrimitiveModel as any) {
	constructor(
		@Inject(BaseSettingsToken)
			baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken)
			tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, tsMorphSettings);
	}

	override getTypeNode(ln?: Node<ts.NamedDeclaration> | ModelClassDeclaration): BoundTypeNode {
		const n = ln ?? this.getLangNode(this.baseSettings.modelImplDir && (!this.baseSettings.modelIntfDir) ? 'impl' : 'intf');
		if (n) {
			if (Node.isNamed(n)) {
				if (isIdentifiedLangNeutral(this) && Node.isExportable(n) && n.isExported())
					return bindAst(n.getNameNode(), this);
				switch (n.getKind()) {
					case SyntaxKind.TypeAliasDeclaration:
						return bindAst((n as TypeAliasDeclaration).getTypeNode(), this);
					case SyntaxKind.ClassDeclaration:
						return bindAst((n as ClassDeclaration).getExtends(), this);
					case SyntaxKind.EnumDeclaration:    // We cannot have an enum that is not exported.
					default:
						throw new Error('Bad internal logic');
				}
			}
			else if (Node.isClassDeclaration(n))
				return bindAst(n.getExtends(), this);
			else if (Node.isTypeAliasDeclaration(n))
				return bindAst(n.getTypeNode(), this);
		}
		return undefined;
	}

	override async generate(sf: SourceFile): Promise<void> {
		if (!this.getLangNode('intf') && this.baseSettings.modelIntfDir) {
			sf = await this.getSrcFile('intf', sf.getProject(), sf);
			if (sf) {
				const {id, fake} = this.ensureIdentifier('intf');
				this.bind('intf', await this.createDecl(sf, id, fake));
			}
		}
		if (!this.getLangNode('impl')) {
			sf = await this.getSrcFile('impl', sf.getProject(), sf);
			if (sf) {
				let retVal: ModelClassDeclaration | ModelTypeAliasDeclaration | undefined;
				let {id, fake} = this.ensureIdentifier('impl');
				let extTxt: string;
				switch (this.jsdType) {
					case 'integer':
					case 'number':
						extTxt = 'Number';
						break;
					case 'string':
						extTxt = 'String';
						break;
					case 'boolean':
						extTxt = 'Boolean';
						break;
					case 'enum':
						retVal = this.bind('impl', await this.createDecl(sf, id, true) as TypeAliasDeclaration);   // Its a fake enum.
						break;
					default:
						break;
				}
				if (extTxt)
					retVal = sf.getClass(id);
				if (!retVal) {
					retVal = sf.addClass({
						name: id,
						isExported: !fake,
						extends: extTxt
					});
					if (this.baseSettings.emitDescriptions && !fake) {
						const docs = this.makeJsDoc();
						if (docs)
							retVal.addJsDoc(docs);
					}
				}
				if (retVal && !retVal.$ast)
					this.bind('impl', retVal);
			}
		}
		if (!this.getLangNode('json'))
			await this.genJson(sf);
	}

	private async createDecl(sf: SourceFile, id: string, fake: boolean): Promise<InterfaceDeclaration | TypeAliasDeclaration | EnumDeclaration> {
		let nativeType = this.jsdType;
		let retVal: (InterfaceDeclaration | TypeAliasDeclaration | EnumDeclaration) & JSDocableNode;
		if (nativeType === 'enum') {
			if (fake) {
				retVal = sf.getTypeAlias(id);
				if (!retVal) {
					// No explicit id, so this will have to be a string literal instead of an enum.
					const enumLiterals = this.oae.enum.map(s => `'${s}'`).join(' | ');
					retVal = sf.addTypeAlias({
						name: id,
						isExported: !fake,
						type: enumLiterals
					});
				}
			}
			else {
				retVal = sf.getEnum(id);
				if (!retVal) {
					retVal = sf.addEnum({
						name: id,
						isConst: true,
						isExported: true,
						members: this.oae.enum.map(s => {
							return {
								name: nameUtils.setCase(s, this.baseSettings.enumElemCasing),
								value: s
							};
						})
					});
				}
			}
		}
		else {
			retVal = sf.getTypeAlias(id);
			if (!retVal) {
				if (nativeType === 'integer')
					nativeType = 'number';
				else if (Array.isArray(nativeType))
					nativeType = nativeType.map(e => e === 'integer' ? 'number' : e).join(' | ') as any;
				retVal = sf.addTypeAlias({
					name: id,
					isExported: !fake,
					type: nativeType
				});
			}
		}
		if (this.baseSettings.emitDescriptions && !fake) {
			const docs = this.makeJsDoc();
			if (docs)
				retVal.addJsDoc(docs);
		}
		return retVal;
	}
}

@Injectable()
export class TsmorphArrayModel extends MixTsmorphModel<BaseArrayModel, ModelTypeAliasDeclaration, ModelClassDeclaration>(BaseArrayModel as any) {
	constructor(
		@Inject(BaseSettingsToken)
			baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken)
			tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, tsMorphSettings);
	}

	override getTypeNode(ln?: ModelTypeAliasDeclaration | ModelClassDeclaration): BoundTypeNode {
		const mlnType = this.baseSettings.modelImplDir && (!this.baseSettings.modelIntfDir) ? 'impl' : 'intf';
		const n = ln ?? this.getLangNode(mlnType);
		if (n) {
			if (isIdentifiedLangNeutral(this) && Node.isExportable(n) && n.isExported())
				return bindAst(n.getNameNode(), this);
			else if (Node.isClassDeclaration(n)) {
				// If this *class* is not named, we need to treat it as a literal type.
				let retVal: TypeNode = n.getFirstDescendantByKind(SyntaxKind.TypeLiteral);
				if (!retVal && mlnType === 'impl')
					retVal = n.getExtends();
				if (!retVal)
					retVal = n.getFirstDescendantByKind(SyntaxKind.TypeReference);
				return bindAst(retVal, this);
			}
			else if (Node.isTypeAliasDeclaration(n))
				return bindAst(n.getTypeNode(), this);
		}
		return undefined;
	}

	override importInto(sf: SourceFile, mlnType?: LangNeutralModelTypes) {
		const t = this.getTypeNode()?.getParent();
		if (t && Node.isExportable(t) && t.isExported())
			super.importInto(sf, mlnType);
		if (isTsmorphModel(this.items))
			this.items.importInto(sf, mlnType);
	}

	override async generate(sf: SourceFile): Promise<void> {
		if (isTsmorphModel(this.items)) {
			await this.items.generate(sf);
			this.addDependency(this.items);
		}
		if (!this.getLangNode('intf') && this.baseSettings.modelIntfDir) {
			sf = await this.getSrcFile('intf', sf.getProject(), sf);
			if (sf) {
				const {id, fake} = this.ensureIdentifier('intf');
				let retVal: ModelTypeAliasDeclaration = fake ? undefined : sf.getTypeAlias(id);
				if (!retVal) {
					retVal = this.bind('intf', sf.addTypeAlias({
						name: id,
						isExported: !fake,
						type: 'Array'
					}));
					if (isTsmorphModel(this.items)) {
						const itemsType = this.items.getTypeNode();
						(retVal.getTypeNode() as TypeReferenceNode).addTypeArgument(itemsType.getText());
					}
					if (this.baseSettings.emitDescriptions && !fake) {
						const docs = this.makeJsDoc();
						if (docs)
							retVal.addJsDoc(docs);
					}
				}
				else if (!retVal.$ast)
					this.bind('intf', retVal);
				this.dependencies.forEach(d => d.importInto(sf));
			}
		}
		if (!this.getLangNode('impl')) {
			sf = await this.getSrcFile('impl', sf.getProject(), sf);
			if (sf) {
				let {id, fake} = this.ensureIdentifier('impl');
				let retVal: ModelClassDeclaration = sf.getClass(id);
				if (!retVal) {
					let tTxt: string;
					let extTxt = 'Array';
					if (isTsmorphModel(this.items)) {
						tTxt = this.items.getTypeNode().getText();
						extTxt += `<${tTxt}>`;
					}
					retVal = sf.addClass({
						name: id,
						isExported: !fake,
						extends: extTxt
					});
					if (this.baseSettings.emitDescriptions && !fake) {
						let docs = this.makeJsDoc();
						if (!docs && tTxt) {
							docs = <JSDocStructure>{
								kind: StructureKind.JSDoc,
								tags: [{
									kind: StructureKind.JSDocTag,
									tagName: `see ${tTxt}`
								}]
							};
						}
						if (docs)
							retVal.addJsDoc(docs);
					}
				}
				if (retVal && !retVal.$ast)
					this.bind('impl', retVal);
				this.dependencies.forEach(d => d.importInto(sf));
			}
		}
		if (!this.getLangNode('json'))
			await this.genJson(sf);
	}
}

@Injectable()
export class TsmorphRecordModel extends MixTsmorphModel<BaseRecordModel, ModelInterfaceDeclaration, ModelClassDeclaration>(BaseRecordModel as any) {
	constructor(
		@Inject(BaseSettingsToken)
			baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken)
			tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, tsMorphSettings);
	}

	override getTypeNode(ln?: ModelInterfaceDeclaration | ModelClassDeclaration): BoundTypeNode {
		const n = ln ?? this.getLangNode<InterfaceDeclaration | ClassDeclaration>(this.baseSettings.modelImplDir && (!this.baseSettings.modelIntfDir) ? 'impl' : 'intf');
		if (n) {
			if (isIdentifiedLangNeutral(this) && Node.isExportable(n) && n.isExported())
				return bindAst(n.getNameNode(), this);
			if (Node.isInterfaceDeclaration(n)) {
				// If this *object* is not named, we need to treat it as a literal type.
				let retVal: TypeNode = n.getFirstDescendantByKind(SyntaxKind.TypeLiteral);
				if (!retVal)
					retVal = n.getFirstDescendantByKind(SyntaxKind.TypeReference);
				return bindAst(retVal, this);
			}
			if (Node.isTypeAliasDeclaration(n))
				return bindAst(n.getTypeNode(), this);
		}
		return undefined;
	}

	override async generate(sf: SourceFile): Promise<void> {
		let retVal: InterfaceDeclaration | TypeAliasDeclaration;
		for (let u of this.unionOf) {
			if (isTsmorphModel(u)) {
				await u.generate(sf);
				this.addDependency(u);
			}
		}
		for (let e of this.extendsFrom) {
			if (isTsmorphModel(e)) {
				await e.generate(sf);
				this.addDependency(e);
			}
		}
		for (const [_, value] of Object.entries(this.properties)) {
			const propModel = value.model;
			if (isTsmorphModel(propModel))
				await propModel.generate(sf);
		}
		const ap = this.additionalProperties;
		if (isTsmorphModel(ap)) {
			await ap.generate(sf);
		}

		if (!this.getLangNode('intf') && this.baseSettings.modelIntfDir) {
			/*
			  Person:
				type: object
				allOf:
				  - $ref: #/components/schemas/NameAge
				  - $ref: #/components/schemas/Origin
				anyOf:
				  - $ref: #/components/schemas/Contacts
				  - $ref: #/components/schemas/Addresses
				properties:
				  race:
					type: string
			---
				interface PersonBase extends NameAge, Origin {
				  race: string;
				}
				type Person = PersonBase & (Contacts | Addresses);
				// or at least
				type Person = NameAge & Origin & {race: string;} & (Contacts | Addresses);
			*/
			sf = await this.getSrcFile('intf', sf.getProject(), sf);
			if (sf) {
				const {id, fake} = this.ensureIdentifier('intf');
				let retVal: ModelInterfaceDeclaration = fake ? undefined : sf.getInterface(id);
				if (!retVal)
					this.bind('intf', await this.createIntf(sf, id, fake, 'intf'));
				else if (!retVal.$ast)
					this.bind('intf', retVal);
				this.dependencies.forEach(d => d.importInto(sf));
			}
		}
		if (!this.getLangNode('impl')) {
			/*
				We need to extend what we can.
				The scenario described above for 'intf' gets more complicated for a class:
				type Person = NameAge & Origin & {race: string;} & (Contacts | Addresses);

				If all were interfaces, we would need to define all properties as declared in NameAge, Origin, and race.
				Then we would need to define all properties in Contacts and Addresses as optional (although perhaps overlaps could be marked required).
				Lastly we would need to provide type-guards for Contacts and Addresses.

				But if some (or all) were classes, it gets even more complicated.
				We might for instance define Person as having race and implementing Contacts and Addresses (with type-guards),
				but then we would have to mixin NameAge and Origin (assuming they were classes).
				The combinations of all these becomes overwhelming.
			*/
			// Perform some sanity checks to see if a TypeScript class can actually implement this Model

			sf = await this.getSrcFile('impl', sf.getProject(), sf);
			if (sf) {
				const {id, fake} = this.ensureIdentifier('impl');
				try {
					if (fake)
						throw new Error('BLOCK-EXIT');
					let retVal: ModelClassDeclaration = sf.getClass(id);
					let intf = this.getLangNode('intf');
					if (!retVal) {
						let extTxt: string;
						let singleExt: TsmorphModel = undefined;
						for (let e of this.extendsFrom) {
							if (isTsmorphModel(e)) {
								// Not possible to extend one *or* the other as a TypeScript class.
								if (isUnionModel(e) && (!isRecordModel(e)))
									throw new Error('BLOCK-EXIT');
								if (isArrayModel(e) || isPrimitiveModel(e)) {
									if (singleExt) {
										// Not feasible to extend *or* even implement multiple arrays and/or primitives simultaneously as a TypeScript class.
										if (isArrayModel(singleExt) || isPrimitiveModel(singleExt))
											throw new Error('BLOCK-EXIT');
										singleExt = e;
									}
								}
								else if (isTypedModel(e))   // This may be a problem, but for now, we will assume extend a user type is always the prefered default.
									singleExt = e;
								else if (isRecordModel(e)) {
									if (isRecordModel(singleExt)) {
										if (Object.keys(e.properties).length > Object.keys(singleExt.properties).length)
											singleExt = e;
									}
									else
										singleExt = e;
								}
							}
						}
						let typeParameters: string[];
						let mutableUnionOf = this.unionOf.slice() as TsmorphModel[];
						if (mutableUnionOf.length === 1) {
							const u = mutableUnionOf[0];
							if (isTsmorphModel(u))
								if (isArrayModel(u) || isPrimitiveModel(u) || isTypedModel(u))
									singleExt = u;
						}
						else if (mutableUnionOf.length > 1) {
							if (mutableUnionOf.every(u => isTsmorphModel(u) && isArrayModel(u))) {
								singleExt = undefined;
								intf = undefined;
								mutableUnionOf.forEach(m => m.importInto(sf));
								let types = mutableUnionOf.map(m => {
									if (isTsmorphModel(m) && isArrayModel(m) && isTsmorphModel(m.items))
										return m.items.getTypeNode().getText();
									return null;
								});
								typeParameters = [`T=${types.join('|')}`];
								extTxt = `Array<T>`;
								mutableUnionOf = [];
							}
						}
						let implTxts: string[];
						if (intf)
							implTxts = [intf.getName()];
						else {
							let intfModels = [] as TsmorphModel[];
							for (let e of this.extendsFrom) {
								if (isTsmorphModel(e))
									if (!singleExt || !Object.is(singleExt, e))
										intfModels.push(e);
							}
							for (let e of mutableUnionOf) {
								if (isTsmorphModel(e))
									if (!singleExt || !Object.is(singleExt, e))
										intfModels.push(e);
							}
							intfModels.forEach(m => m.importInto(sf));
							implTxts = intfModels.map(m => {
								if (isTsmorphModel(m))
									return m.getTypeNode().getText();
								return null;
							});
						}
						if (singleExt) {
							singleExt.importInto(sf, 'impl');
							extTxt = singleExt.getTypeNode(singleExt.getLangNode('impl')).getText();
						}

						retVal = this.bind('impl', sf.addClass({
							name: id,
							isExported: true,
							extends: extTxt,
							implements: implTxts.length > 0 ? implTxts : undefined,
							typeParameters: typeParameters
						}));
						this.importInto(sf);
						if (Object.keys(this.properties).length > 0 || this.additionalProperties)
							await this.genProperties(sf, 'impl', retVal);
						this.dependencies.forEach(d => d.importInto(sf));
						if (this.baseSettings.emitDescriptions) {
							const docs = intf ? <JSDocStructure>{
								kind: StructureKind.JSDoc,
								tags: [{
									kind: StructureKind.JSDocTag,
									tagName: 'inheritDoc'
								}]
							} : this.makeJsDoc();
							if (docs)
								retVal.addJsDoc(docs);
						}
						let rebind = false;
						const ls = sf.getProject().getLanguageService();
						const supportedCodeFixes = ls.compilerObject.getSupportedCodeFixes(sf.getFilePath());
						const sem = ls.compilerObject.getSemanticDiagnostics(sf.getFilePath());
						sem.reverse().forEach(s => {
							if (supportedCodeFixes.indexOf(String(s.code)) >= 0) {
								const fixes = ls.getCodeFixesAtPosition(sf,
									s.start,
									s.start + s.length,
									[s.code],
									this.tsMorphSettings.format,
									undefined
								);
								fixes.slice().reverse().forEach(fix => {
									fix.getChanges().reverse().forEach(c => c.applyChanges());
									rebind = true;
								});
							}
							else
								throw new Error('BLOCK-EXIT');
						});
						if (rebind)
							this.bind('impl', sf.getClass(id));
					}
					else if (!retVal.$ast)
						this.bind('impl', retVal);
				}
				catch (e) {
					if ((e as Error).message !== 'BLOCK-EXIT')
						throw e;
					if (!fake)
						sf.deleteImmediatelySync();
				}
			}
		}
		if (!this.getLangNode('json'))
			await this.genJson(sf);
	}

	/**
	 * This method is shared for both interface creation and in rare scenarios for class "support".
	 * We can't generate a class without a name.
	 * If no name was provided (e.g. is fake), we create a fake interface, and use it's type (aka inline) in API params.
	 */
	private async createIntf(sf: SourceFile, id: string, fake: boolean, scope: 'intf' | 'impl'): Promise<InterfaceDeclaration | TypeAliasDeclaration> {
		let retVal: InterfaceDeclaration | TypeAliasDeclaration;
		let unionTxt = '';
		for (let u of this.unionOf) {
			if (isTsmorphModel(u)) {
				const t = u.getTypeNode();
				if (unionTxt)
					unionTxt += ' | ';
				unionTxt += t.getText();
			}
		}
		let subTypes: string[] = [];
		let asTypeAlias = unionTxt || fake;
		for (let e of this.extendsFrom) {
			if (isTsmorphModel(e)) {
				if (!isIdentifiedLangNeutral(e))
					asTypeAlias = true;
				const t = e.getTypeNode();
				subTypes.push(t.getText());
			}
		}
		const hasProps = Object.keys(this.properties).length > 0 || this.additionalProperties;
		if (asTypeAlias) {
			let line: string;
			if (unionTxt)
				line = subTypes.join(' & ') + `${subTypes.length > 0 ? ' & ' : ''}(` + unionTxt + `)${hasProps ? ' & {}' : ''}`;
			else if (subTypes.length > 0)
				line = subTypes.join(' & ') + `${hasProps ? ' & {}' : ''}`;
			else
				line = '{}';
			retVal = sf.addTypeAlias({
				name: id,
				isExported: !fake,
				type: (writer) => {
					writer.writeLine(line);
				}
			});
			if (hasProps) {
				const tls = retVal.getDescendants().filter(d => d.getKind() == SyntaxKind.TypeLiteral);
				if (tls.length > 0)
					await this.genProperties(sf, scope, tls[tls.length - 1] as TypeLiteralNode);
			}
		}
		else {
			retVal = sf.addInterface({
				name: id,
				isExported: true,
				extends: subTypes.length > 0 ? subTypes : undefined
			});
			if (hasProps)
				await this.genProperties(sf, 'intf', retVal);
		}
		if (this.baseSettings.emitDescriptions && !fake) {
			const docs = this.makeJsDoc();
			if (docs)
				retVal.addJsDoc(docs);
		}
		return retVal;
	}

	private async genProperties(sf: SourceFile, ownerScope: 'intf' | 'impl', owner: ClassDeclaration | InterfaceDeclaration | TypeLiteralNode): Promise<void> {
		for (const [key, value] of Object.entries(this.properties)) {
			const propModel = value.model;
			if (!isTsmorphModel(propModel))
				continue;
			await propModel.generate(sf);
			let propType = propModel.getTypeNode();
			this.addDependency(propModel);
			const prop = owner.addProperty({
				name: key,
				hasQuestionToken: !value.required,
				type: propType.getText()
			});
			if (this.baseSettings.emitDescriptions) {
				if (propModel.name) {
					prop.addJsDoc({
						kind: StructureKind.JSDoc,
						description: '@see ' + propModel.name
					});
				}
				else {
					const docs = (propModel as this).makeJsDoc();
					if (docs)
						prop.addJsDoc(docs);
				}
			}
		}
		const ap = this.additionalProperties;
		if (ap && isTsmorphModel(ap)) {
			await ap.generate(sf);
			let propType = ap.getTypeNode();
			this.addDependency(ap);
			let sig;
			if (Node.isClassDeclaration(owner)) {
				// See https://github.com/dsherret/ts-morph/issues/1413
				// Thanks @draconisNoctis !
				const declMergeIntf = owner.getSourceFile().addInterface({
					name: owner.getName(),
					isExported: true
				});
				sig = declMergeIntf.addIndexSignature({
					keyName: 'key',
					keyType: 'string | number',
					returnType: propType.getText()
				});
			}
			else {
				sig = owner.addIndexSignature({
					keyName: 'key',
					keyType: 'string | number',
					returnType: propType.getText()
				});
			}
			if (this.baseSettings.emitDescriptions) {
				if (propType) {
					const docs = (ap as this).makeJsDoc();
					if (docs)
						sig.addJsDoc(docs);
				}
			}
		}
	}
}

@Injectable()
export class TsmorphTypedModel extends MixTsmorphModel<BaseTypedModel>(BaseTypedModel as any) {
	constructor(
		@Inject(BaseSettingsToken)
			baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken)
			tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, tsMorphSettings);
	}

	getTypeNode(ln?: Node): BoundTypeNode {
		const n = ln ?? this.getLangNode<Node>(this.baseSettings.modelImplDir && (!this.baseSettings.modelIntfDir) ? 'impl' : 'intf');
		if (n) {
			if (Node.isTypeAliasDeclaration(n)) {
				if (isIdentifiedLangNeutral(this))
					return n.getNameNode() as any;
				return n.getTypeNode() as any;
			}
		}
		return undefined;
	}

	override async generate(sf: SourceFile): Promise<void> {
		if (!this.getLangNode('intf') && this.baseSettings.modelIntfDir) {
			sf = await this.getSrcFile('intf', sf.getProject(), sf);
			if (sf) {
				const {id, fake} = this.ensureIdentifier('intf');
				let retVal: ModelTypeAliasDeclaration = fake ? undefined : sf.getTypeAlias(id);
				if (!retVal) {
					retVal = this.bind('intf', sf.addTypeAlias({
						name: id,
						isExported: !fake,
						type: this.typeName
					}));
					if (this.baseSettings.emitDescriptions && !fake) {
						const docs = this.makeJsDoc();
						if (docs)
							retVal.addJsDoc(docs);
					}
				}
				else if (!retVal.$ast)
					this.bind('intf', retVal);
			}
		}
		if (!this.getLangNode('impl')) {
			sf = await this.getSrcFile('impl', sf.getProject(), sf);
			if (sf) {
				let {id, fake} = this.ensureIdentifier('impl');
				let retVal: ModelTypeAliasDeclaration = fake ? undefined : sf.getTypeAlias(id);
				if (!retVal) {
					const intf = this.getTypeNode();
					retVal = this.bind('impl', sf.addTypeAlias({
						name: id,
						isExported: !fake,
						type: intf?.getText() ?? this.typeName
					}));
					if (this.baseSettings.emitDescriptions && !fake) {
						const docs = this.makeJsDoc();
						if (docs)
							retVal.addJsDoc(docs);
					}
				}
				else if (!retVal.$ast)
					this.bind('impl', retVal);
			}
		}
		if (!this.getLangNode('json'))
			await this.genJson(sf);
	}
}
