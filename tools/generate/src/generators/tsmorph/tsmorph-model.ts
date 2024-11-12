import {Inject, Injectable} from 'async-injection';
import {stringify as json5Stringify} from 'json5';
import os from 'node:os';
import path from 'node:path';
import {LangNeutralType, Model} from 'oag-shared/lang-neutral';
import {BaseArrayModel, BasePrimitiveModel, BaseRecordModel, BaseSettingsToken, BaseSettingsType, BaseTypedModel, BaseUnionModel} from 'oag-shared/lang-neutral/base';
import {BaseModel} from 'oag-shared/lang-neutral/base/base-model';
import {isFileBasedLangNeutral, isIdentifiedLangNeutral} from 'oag-shared/lang-neutral/lang-neutral';
import {isSchemaModel, LangNeutralModelTypes} from 'oag-shared/lang-neutral/model';
import * as nameUtils from 'oag-shared/utils/name-utils';
import {ClassDeclaration, EnumDeclaration, Identifier, InterfaceDeclaration, JSDocableNode, JSDocStructure, Node, ObjectLiteralElement, Project, SourceFile, StructureKind, ts, Type, TypeAliasDeclaration, TypeLiteralNode, TypeNode, TypeReferenceNode, VariableDeclarationKind, VariableStatement} from 'ts-morph';
import {TsMorphSettingsToken, TsMorphSettingsType} from '../../settings/tsmorph';
import {bindAst, importIfNotSameFile, makeFakeIdentifier, TempFileName} from './oag-tsmorph';
import SyntaxKind = ts.SyntaxKind;

interface ModelInterfaceDeclaration extends InterfaceDeclaration {
	readonly $ast?: Model & TsmorphModel<InterfaceDeclaration | ClassDeclaration | ObjectLiteralElement>;
}

interface ModelClassDeclaration extends ClassDeclaration {
	readonly $ast?: Model & TsmorphModel<InterfaceDeclaration | ClassDeclaration | ObjectLiteralElement>;
}

interface ModelVariableStatement extends VariableStatement {
	readonly $ast?: Model & TsmorphModel<InterfaceDeclaration | ClassDeclaration | ObjectLiteralElement>;
}

interface ModelEnumDeclaration extends EnumDeclaration {
	readonly $ast?: Model & TsmorphModel;
}

interface ModelTypeAliasDeclaration extends TypeAliasDeclaration {
	readonly $ast?: Model & TsmorphModel;
}

export interface TsmorphModel<I extends Node = Node, C extends Node = Node, J extends Node = Node> extends Model {
	getLangNode(type: 'intf'): I;

	getLangNode(type: 'impl'): C;

	getLangNode(type: 'json'): J;

	getTypeNode(type: 'intf'): TypeNode;

	getTypeNode(type: 'impl'): TypeNode;

	getTypeNode(type: 'json'): TypeNode;

	genIntf(sf: SourceFile): Promise<I>;

	genImpl(sf: SourceFile): Promise<C>;

	genJson(sf: SourceFile): Promise<J>;

	addDependency(m: TsmorphModel, sf: SourceFile, type: 'intf' | 'impl' | 'json'): void;

	bind(type: 'intf', ast: Omit<I, '$ast'>): I;

	bind(type: 'impl', ast: Omit<C, '$ast'>): C;

	bind(type: 'json', ast: Omit<J, '$ast'>): J;

	makeJsDoc(): JSDocStructure;

	readonly dependencies: ReadonlyArray<Readonly<Model>>;
}

export function isTsmorphModel(obj: Readonly<Model>): obj is TsmorphModel {
	if (typeof obj.getLangNode === 'function')
		if (typeof (obj as unknown as TsmorphModel).genIntf === 'function')
			if (typeof (obj as unknown as TsmorphModel).bind === 'function')
				if (typeof (obj as unknown as TsmorphModel).makeJsDoc === 'function')
					if (typeof (obj as any).getSrcFile === 'function')
						return true;
	return false;
}

function MixTsmorphModel<T extends BaseModel, I extends Node = Node, C extends Node = Node, J extends Node = Node>(base: T) {
	// @ts-ignore
	const derived = class extends base implements Model, TsmorphModel<I, C, J> {
		constructor(baseSettings: BaseSettingsType, protected readonly tsMorphSettings: TsMorphSettingsType) {
			super(baseSettings);
			this.#tsTypes = {} as any;
			this.#dependencies = [];
		}

		getLangNode(type: 'intf'): I;
		getLangNode(type: 'impl'): C;
		getLangNode(type: 'json'): J;
		getLangNode(type: Extract<LangNeutralType, 'intf' | 'impl' | 'json'>): I | C | J | undefined {
			return this.#tsTypes[type];
		}

		readonly #tsTypes: {
			intf: I,
			impl: C,
			json: J
		};

		/**
		 * By wrapping 'bindAst' we not only perform the binding, but we set our own reference, so that once this call is done, the binding is bidirectional.
		 * This is important for nested generation calls.
		 */
		bind(type: 'intf', ast: Omit<I, '$ast'>): I;
		bind(type: 'impl', ast: Omit<C, '$ast'>): C;
		bind(type: 'json', ast: Omit<J, '$ast'>): J;
		bind(type: Extract<LangNeutralType, 'intf' | 'impl' | 'json'>, ast: Omit<I, '$ast'> | Omit<C, '$ast'> | Omit<J, '$ast'>): I | C | J {
			this.#tsTypes[type] = bindAst(ast as any, this) as any;
			return this.#tsTypes[type];
		}

		protected async getSrcFile(type: Extract<LangNeutralType, 'intf' | 'impl' | 'json'>, proj: Project, sf?: SourceFile): Promise<SourceFile> {
			if (isFileBasedLangNeutral(this)) {
				const fp = this.getFilepath(type);
				if (fp) {
					const fullPath = path.join(proj.getCompilerOptions().outDir, fp) + '.ts';
					sf = proj.getSourceFile(fullPath);
					if (!sf)
						sf = proj.createSourceFile(fullPath, '', {overwrite: false});
				}
				if (sf)
					return sf;
			}
			return proj.getSourceFile(TempFileName);
		}

		readonly #dependencies: Model[];
		get dependencies() {
			return this.#dependencies;
		}

		addDependency(m: TsmorphModel, sf: SourceFile, type: Extract<LangNeutralType, 'intf' | 'impl' | 'json'>): void {
			if (isFileBasedLangNeutral(m)) {
				if (!this.#dependencies.find(d => Object.is(d, m))) {
					const t = m.getTypeNode(type as any);
					if (t)
						importIfNotSameFile(sf, m.getLangNode(type as any), t.getText());
					this.#dependencies.push(m);
				}
			}
			else {
				m.dependencies.forEach(md => {
					if (isTsmorphModel(md)) {
						if (!this.#dependencies.find(d => Object.is(d, md))) {
							const t = md.getTypeNode(type as any);
							if (t)
								importIfNotSameFile(sf, md.getLangNode(type as any), t.getText());
							this.#dependencies.push(md);
						}
					}
				});
			}
		}

		genIntf(sf: SourceFile): Promise<I> {
			throw new Error('Bad internal logic');
		}

		genImpl(sf: SourceFile): Promise<C> {
			throw new Error('Bad internal logic');
		}

		genJson(sf: SourceFile): Promise<J> {
			throw new Error('Bad internal logic');
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

		ensureIdentifier(type: LangNeutralModelTypes) {
			let isIdentifier: boolean;
			let identifier: string;
			if (isIdentifiedLangNeutral(this)) {
				isIdentifier = true;
				identifier = this.getIdentifier(type);
			}
			if (!identifier) {
				isIdentifier = false;
				identifier = makeFakeIdentifier();
			}
			return {
				id: identifier,
				fake: !isIdentifier
			};
		}
	};
	return derived as new (baseSettings: BaseSettingsType, tsMorphSettings: TsMorphSettingsType) => T & typeof derived.prototype;
}

export class TsmorphUnionModel extends MixTsmorphModel<BaseUnionModel>(BaseUnionModel as any) {
	constructor(
		baseSettings: BaseSettingsType,
		tsMorphSettings: TsMorphSettingsType
	) {
		super(baseSettings, tsMorphSettings);
	}

	getTypeNode(type: Extract<LangNeutralType, 'intf' | 'impl' | 'json'>): TypeNode | Identifier | undefined {
		const n = this.getLangNode('intf') as ModelTypeAliasDeclaration;
		if (n) {
			if (isIdentifiedLangNeutral(this))
				return n.getNameNode();
			return n.getTypeNode();
		}
		return undefined;
	}

	override async genIntf(sf: SourceFile): Promise<ModelTypeAliasDeclaration> {
		if (this.getLangNode('intf'))
			return this.getLangNode('intf');
		sf = await this.getSrcFile('intf', sf.getProject(), sf);
		const {id, fake} = this.ensureIdentifier('intf');
		let retVal: ModelTypeAliasDeclaration = sf.getTypeAlias(id);
		let types: TypeNode[] = [];
		for (let u of this.unionOf) {
			if (isTsmorphModel(u)) {
				await u.genIntf(sf);
				types.push(u.getTypeNode('intf'));
				this.addDependency(u, sf, 'intf');
			}
		}
		const typeTxt = types.map(t => t.getText());
		if (!retVal) {
			retVal = this.bind('intf', sf.addTypeAlias({
				name: id,
				isExported: !fake,
				type: typeTxt.join(' | ')
			}));
			if (this.baseSettings.emitDescriptions) {
				const docs = this.makeJsDoc();
				if (docs)
					retVal.addJsDoc(docs);
			}
		}
		else if (!retVal.$ast)
			retVal = this.bind('intf', retVal);
		return retVal;
	}
}

@Injectable()
export class TsmorphPrimitiveModel extends MixTsmorphModel<BasePrimitiveModel, Node<ts.NamedDeclaration>, never, never>(BasePrimitiveModel as any) {
	constructor(
		@Inject(BaseSettingsToken)
			baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken)
			tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, tsMorphSettings);
	}

	getTypeNode(type: Extract<LangNeutralType, 'intf' | 'impl' | 'json'>): TypeNode | Type | Identifier | undefined {
		const n = this.getLangNode('intf');
		if (n) {
			if (isIdentifiedLangNeutral(this))
				return n.getNameNode();
			switch (n.getKind()) {
				case SyntaxKind.TypeAliasDeclaration:
					return (n as TypeAliasDeclaration).getTypeNode();
				case SyntaxKind.EnumDeclaration:
					return (n as EnumDeclaration).getNameNode();
				default:
					return n.getType();
			}
		}
		return undefined;
	}

	override async genIntf(sf: SourceFile): Promise<Node<ts.NamedDeclaration>> {
		if (this.getLangNode('intf'))
			return this.getLangNode('intf');
		sf = await this.getSrcFile('intf', sf.getProject(), sf);
		const {id, fake} = this.ensureIdentifier('intf');
		let nativeType = this.jsdType;
		let retVal: Node<ts.NamedDeclaration> & JSDocableNode;
		if ((nativeType === 'string' || nativeType === 'enum') && Array.isArray(this.oae.enum)) {
			if (fake) {
				// No explicit id, so this will have to be a string literal instead of an enum.
				const enumLiterals = this.oae.enum.map(s => `'${s}'`).join(' | ');
				retVal = this.bind('intf', sf.addTypeAlias({
					name: id,
					isExported: !fake,
					type: enumLiterals
				}));
			}
			else {
				retVal = this.bind('intf', sf.addEnum({
					name: id,
					isConst: true,
					isExported: true,
					members: this.oae.enum.map(s => {
						return {
							name: nameUtils.setCase(s, this.baseSettings.enumElemCasing),
							value: s
						};
					})
				}));
			}
			if (this.baseSettings.emitDescriptions && !fake) {
				const docs = this.makeJsDoc();
				if (docs)
					retVal.addJsDoc(docs);
			}
		}
		else {
			if (nativeType === 'integer')
				nativeType = 'number';
			if (Array.isArray(nativeType))
				nativeType = nativeType.map(e => e === 'integer' ? 'number' : e).join(' | ') as any;
			retVal = this.bind('intf', sf.addTypeAlias({
				name: id,
				isExported: !fake,
				type: nativeType
			}));
			if (this.baseSettings.emitDescriptions && !fake) {
				const docs = this.makeJsDoc();
				if (docs)
					retVal.addJsDoc(docs);
			}
		}
		if (!(retVal as any).$ast)
			retVal = this.bind('intf', retVal);
		return retVal;
	}

	genImpl(sf: SourceFile): Promise<void> {
		return Promise.resolve();
	}

	genJson(sf: SourceFile): Promise<void> {
		return Promise.resolve();
	}
}

@Injectable()
export class TsmorphArrayModel extends MixTsmorphModel<BaseArrayModel>(BaseArrayModel as any) {
	constructor(
		@Inject(BaseSettingsToken)
			baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken)
			tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, tsMorphSettings);
	}

	getTypeNode(type: Extract<LangNeutralType, 'intf' | 'impl' | 'json'>): TypeNode | Identifier | undefined {
		const n = this.getLangNode('intf') as ModelTypeAliasDeclaration;
		if (n) {
			if (isIdentifiedLangNeutral(this))
				return n.getNameNode();
			return n.getTypeNode();
		}
		return undefined;
	}

	override addDependency(m: TsmorphModel, sf: SourceFile, type: Extract<LangNeutralType, 'intf' | 'impl' | 'json'>): void {
		super.addDependency(m, sf, type);
		if (isTsmorphModel(this.items))
			super.addDependency(this.items, sf, type);
	}

	override async genIntf(sf: SourceFile): Promise<ModelTypeAliasDeclaration> {
		if (this.getLangNode('intf'))
			return this.getLangNode('intf');
		sf = await this.getSrcFile('intf', sf.getProject(), sf);
		const {id, fake} = this.ensureIdentifier('intf');
		let retVal: ModelTypeAliasDeclaration = fake ? undefined : sf.getTypeAlias(id);
		if (!retVal) {
			retVal = this.bind('intf', sf.addTypeAlias({
				name: id,
				isExported: !fake,
				type: 'Array'
			}));
			if (this.baseSettings.emitDescriptions && !fake) {
				const docs = this.makeJsDoc();
				if (docs)
					retVal.addJsDoc(docs);
			}
			if (isTsmorphModel(this.items)) {
				await this.items.genIntf(sf);
				super.addDependency(this.items, sf, 'intf');
				const itemsType = this.items.getTypeNode('intf');
				(retVal.getTypeNode() as TypeReferenceNode).addTypeArgument(itemsType.getText());
			}
		}
		else if (!retVal.$ast)
			this.bind('intf', retVal);
		return retVal;
	}
}

@Injectable()
export class TsmorphRecordModel extends MixTsmorphModel<BaseRecordModel>(BaseRecordModel as any) {
	constructor(
		@Inject(BaseSettingsToken)
			baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken)
			tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, tsMorphSettings);
	}

	getTypeNode(type: Extract<LangNeutralType, 'intf' | 'impl' | 'json'>): Node | undefined {
		const n = this.getLangNode('intf') as InterfaceDeclaration;
		if (n) {
			if (isIdentifiedLangNeutral(this))
				return n.getNameNode();
			// If this *object* is not named, we need to treat it as a literal type.
			let retVal: Node = n.getFirstDescendantByKind(SyntaxKind.TypeLiteral);
			if (!retVal)
				retVal = n.getFirstDescendantByKind(SyntaxKind.TypeReference);
			return retVal;
		}
		return undefined;
	}

	override async genIntf(sf: SourceFile): Promise<ModelInterfaceDeclaration> {
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
		if (this.getLangNode('intf'))
			return this.getLangNode('intf');
		sf = await this.getSrcFile('intf', sf.getProject(), sf);
		const {id, fake} = this.ensureIdentifier('intf');
		let retVal: ModelInterfaceDeclaration = fake ? undefined : sf.getInterface(id);
		if (!retVal) {
			let unionTxt = '';
			for (let u of this.unionOf) {
				if (isTsmorphModel(u)) {
					await u.genIntf(sf);
					this.addDependency(u, sf, 'intf');
					const t = u.getTypeNode('intf');
					if (unionTxt)
						unionTxt += ' | ';
					unionTxt += t.getText();
				}
			}
			let subTypes: string[] = [];
			let asTypeAlias = unionTxt || fake;
			for (let e of this.extendsFrom) {
				if (isTsmorphModel(e)) {
					await e.genIntf(sf);
					this.addDependency(e, sf, 'intf');
					if (!isIdentifiedLangNeutral(e))
						asTypeAlias = true;
					const t = e.getTypeNode('intf');
					subTypes.push(t.getText());
				}
			}
			const hasProps = Object.keys(this.properties).length > 0 || this.additionalProperties;
			if (asTypeAlias) {
				let line: string;
				if (unionTxt)
					line = subTypes.join(' & ') + ` ${subTypes.length > 0 ? ' & ' : ''}(` + unionTxt + `)${hasProps ? ' & {}' : ''}`;
				else if (subTypes.length > 0)
					line = subTypes.join(' & ') + `${hasProps ? ' & {}' : ''}`;
				else
					line = '{}';
				const ta = sf.addTypeAlias({
					name: id,
					isExported: !fake,
					type: (writer) => {
						writer.writeLine(line);
					}
				});
				if (hasProps) {
					const tls = ta.getDescendants().filter(d => d.getKind() == SyntaxKind.TypeLiteral);
					if (tls.length > 0)
						await this.genIntfProperties(sf, tls[tls.length - 1] as TypeLiteralNode);
				}
				retVal = this.bind('intf', ta);
			}
			else {
				retVal = this.bind('intf', sf.addInterface({
					name: id,
					isExported: true,
					extends: subTypes.length > 0 ? subTypes : undefined
				}));
				if (hasProps)
					await this.genIntfProperties(sf, retVal);
			}
			if (this.baseSettings.emitDescriptions && !fake) {
				const docs = this.makeJsDoc();
				if (docs)
					retVal.addJsDoc(docs);
			}
		}
		else if (!retVal.$ast)
			this.bind('intf', retVal);
		return retVal;
	}

	protected async genIntfProperties(sf: SourceFile, intf: InterfaceDeclaration | TypeLiteralNode): Promise<void> {
		for (const [key, value] of Object.entries(this.properties)) {
			const propModel = value.model;
			if (!isTsmorphModel(propModel))
				continue;
			await propModel.genIntf(sf);
			this.addDependency(propModel, sf, 'intf');
			const propType = propModel.getTypeNode('intf');
			const prop = intf.addProperty({
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
					const docs = propModel.makeJsDoc();
					if (docs)
						prop.addJsDoc(docs);
				}
			}
		}
		const ap = this.additionalProperties;
		if (ap && isTsmorphModel(ap)) {
			await ap.genIntf(sf);
			this.addDependency(ap, sf, 'intf');
			const apType = ap.getTypeNode('intf');
			const sig = intf.addIndexSignature({
				keyName: 'key',
				keyType: 'string | number',
				returnType: apType.getText()
			});
			if (this.baseSettings.emitDescriptions) {
				if (apType) {
					const docs = ap.makeJsDoc();
					if (docs)
						sig.addJsDoc(docs);
				}
			}
		}
	}

	override async genImpl(sf: SourceFile): Promise<ModelClassDeclaration> {
		if (this.getLangNode('impl'))
			return this.getLangNode('impl');
		sf = await this.getSrcFile('impl', sf.getProject(), sf);
		const identifier = this.getIdentifier('impl');
		let retVal: ModelClassDeclaration = sf.getClass(identifier);
		if (!retVal) {
			const i = this.getLangNode('intf');
			retVal = this.bind('impl', sf.addClass({
				name: identifier,
				isExported: true,
				implements: i ? [i.getName()] : undefined
			}));
			this.addDependency(this as unknown as TsmorphModel, sf, 'intf');
		}
		else if (!retVal.$ast)
			this.bind('impl', retVal);
		return retVal;
	}

	override async genJson(sf: SourceFile): Promise<ModelVariableStatement> {
		if (this.getLangNode('json'))
			return this.getLangNode('json');
		if (!isSchemaModel(this))
			throw new TypeError('Bad internal logic');
		sf = await this.getSrcFile('json', sf.getProject(), sf);
		const identifier = this.getIdentifier('json');
		let retVal: ModelVariableStatement = sf.getVariableStatement(identifier);
		if (!retVal) {
			retVal = this.bind('json', sf.addVariableStatement({
				declarationKind: VariableDeclarationKind.Const,
				isExported: true,
				declarations: [{
					name: identifier,
					initializer: json5Stringify(this.oae, undefined, '\t')
				}]
			}));
		}
		else if (!retVal.$ast)
			this.bind('json', retVal);
		return retVal;
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

	getTypeNode(type: Extract<LangNeutralType, 'intf' | 'impl' | 'json'>): Type | Identifier | undefined {
		const n = this.getLangNode('intf') as ModelTypeAliasDeclaration;
		if (n) {
			if (isIdentifiedLangNeutral(this))
				return n.getNameNode();
			return n.getType();
		}
		return undefined;
	}

	override async genIntf(sf: SourceFile): Promise<ModelTypeAliasDeclaration> {
		if (this.getLangNode('intf'))
			return this.getLangNode('intf');
		sf = await this.getSrcFile('intf', sf.getProject(), sf);
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
		return retVal;
	}
}
