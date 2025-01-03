import {Inject, Injectable} from 'async-injection';
import {stringify as json5Stringify} from 'json5';
import {template as lodashTemplate} from 'lodash';
import os from 'node:os';
import path from 'node:path';
import {LangNeutralType, Model} from 'oag-shared/lang-neutral';
import {BaseArrayModel, BasePrimitiveModel, BaseRecordModel, BaseSettingsToken, BaseSettingsType, BaseTypedModel, BaseUnionModel, CodeGenAst} from 'oag-shared/lang-neutral/base';
import {BaseModel} from 'oag-shared/lang-neutral/base/base-model';
import {isFileBasedLangNeutral, isIdentifiedLangNeutral} from 'oag-shared/lang-neutral/lang-neutral';
import {isSchemaModel, LangNeutralModelTypes} from 'oag-shared/lang-neutral/model';
import {safeLStatSync} from 'oag-shared/utils/misc-utils';
import * as nameUtils from 'oag-shared/utils/name-utils';
import {ClassDeclaration, EnumDeclaration, Identifier, InterfaceDeclaration, JSDocableNode, JSDocStructure, Node, ObjectLiteralElement, Project, SourceFile, StructureKind, ts, TypeAliasDeclaration, TypeLiteralNode, TypeNode, TypeReferenceNode, VariableDeclarationKind, VariableStatement} from 'ts-morph';
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

export interface TsmorphModel<I extends Node = Node, C extends Node | void = Node> extends Model {
	readonly tsMorphSettings: TsMorphSettingsType;

	getLangNode(mlnType: 'intf'): I;

	getLangNode(mlnType: 'impl'): C;

	getLangNode(mlnType: 'json'): ModelVariableStatement;

	genIntf(sf: SourceFile): Promise<I>;
	genImpl(sf: SourceFile): Promise<C>;

	genJson(sf: SourceFile): Promise<ModelVariableStatement>;

	makeJsDoc(): JSDocStructure | undefined;

	getTypeNode(preferredMlnType: LangNeutralModelTypes): TypeNode | Identifier | undefined;
}

export function isTsmorphModel(obj: Readonly<Model>): obj is TsmorphModel {
	if (typeof obj.getLangNode === 'function')
		if (typeof (obj as unknown as TsmorphModel).genIntf === 'function')
			if (typeof (obj as unknown as any).getSrcFile === 'function')
				if (typeof (obj as unknown as any).bind === 'function')
					if (typeof (obj as unknown as any).makeJsDoc === 'function')
						return true;
	return false;
}

function MixTsmorphModel<T extends BaseModel, I extends Node = Node, C extends Node | void = Node>(base: any) {
	//@ts-ignore
	const derived = class extends base implements TsmorphModel<I, C> {
		constructor(baseSettings: BaseSettingsType, readonly tsMorphSettings: TsMorphSettingsType) {
			super(baseSettings);
			this.#tsTypes = {} as any;
			this.#dependencies = {intf: [], impl: [], json: []};
		}
		readonly #tsTypes: {
			intf: I,
			impl: C,
			json: VariableStatement
		};

		get dependencies(): Record<LangNeutralModelTypes, ReadonlyArray<TsmorphModel>> {
			return this.#dependencies;
		}

		readonly #dependencies: Record<LangNeutralModelTypes, TsmorphModel[]>;

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

		getTypeNode(preferredMlnType: LangNeutralModelTypes): TypeNode | Identifier | undefined {
			throw new Error('Bad internal logic');
		}

		genIntf(sf: SourceFile): Promise<I> {
			throw new Error('Bad internal logic');
		}
		genImpl(sf: SourceFile): Promise<C> {
			throw new Error('Bad internal logic');
		}
		async genJson(sf: SourceFile): Promise<ModelVariableStatement> {
			if (this.getLangNode('json'))
				return this.getLangNode('json');
			if (isSchemaModel(this) && isFileBasedLangNeutral(this)) {
				sf = await this.getSrcFile('json', sf.getProject(), sf);
				if (sf) {
					const {id, fake} = this.ensureIdentifier('json');
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
									this.addDependency('json', sf, model, 'json');
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
						retVal = this.bind('json', retVal);
					return retVal;
				}
			}
			return Promise.resolve(null);
		}

		protected addDependency(mlnType: LangNeutralModelTypes, sf: SourceFile, dependent: TsmorphModel, depMlnType: LangNeutralModelTypes): void {
			if (isFileBasedLangNeutral(dependent)) {
				if (!this.#dependencies[mlnType].find(d => Object.is(d, dependent))) {
					const t = dependent.getTypeNode(depMlnType);
					if (t)
						importIfNotSameFile(sf, t, t.getText());
					this.#dependencies[mlnType].push(dependent);
				}
			}
			else {
				// Everything we might add will of course be a TsMorphModel mixin.
				(dependent as unknown as this).dependencies[depMlnType].forEach(md => {
					if (!this.#dependencies[mlnType].find(d => Object.is(d, md))) {
						const t = md.getTypeNode(depMlnType);
						if (t)
							importIfNotSameFile(sf, t, t.getText());
						this.#dependencies[mlnType].push(md);
					}
				});
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

		protected async getSrcFile(mlnType: LangNeutralModelTypes | Uppercase<LangNeutralModelTypes>, proj: Project, sf?: SourceFile): Promise<SourceFile> {
			switch (mlnType) {
				case 'intf':
					if (!this.baseSettings.modelIntfDir)
						return Promise.resolve(null);
					break;
				case 'impl':
					if (!this.baseSettings.modelImplDir)
						return Promise.resolve(null);
					break;
				case 'json':
					if (!this.baseSettings.modelJsonDir)
						return Promise.resolve(null);
					break;
			}
			mlnType = mlnType.toLowerCase() as LangNeutralModelTypes;
			if (isFileBasedLangNeutral(this)) {
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
			return proj.getSourceFile(TempFileName);
		}

		protected ensureIdentifier(type: LangNeutralModelTypes) {
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

	override getTypeNode(preferredMlnType: LangNeutralModelTypes): TypeNode | Identifier | undefined {
		if (preferredMlnType === 'impl')
			preferredMlnType = 'intf';
		const n = this.getLangNode<Node>(preferredMlnType);
		if (n) {
			if (Node.isTypeAliasDeclaration(n)) {
				if (isIdentifiedLangNeutral(this))
					return n.getNameNode();
				return n.getTypeNode();
			}
			if (Node.isVariableStatement(n))
				if (isIdentifiedLangNeutral(this))
					return n.getFirstDescendantByKind(SyntaxKind.VariableDeclaration)?.getNameNode() as Identifier;
		}
		return undefined;
	}

	override async genIntf(sf: SourceFile): Promise<ModelTypeAliasDeclaration> {
		if (this.getLangNode('intf'))
			return this.getLangNode('intf');
		sf = await this.getSrcFile('intf', sf.getProject(), sf);
		if (!sf)
			return Promise.resolve(null);
		const {id, fake} = this.ensureIdentifier('intf');
		let retVal: ModelTypeAliasDeclaration = fake ? undefined : sf.getTypeAlias(id);
		if (!retVal) {
			let types: Node[] = [];
			for (let u of this.unionOf) {
				if (isTsmorphModel(u)) {
					await u.genIntf(sf);
					types.push(u.getTypeNode('intf'));
					this.addDependency('intf', sf, u, 'intf');
				}
			}
			const typeTxt = types.map(t => t.getText());
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

	override async genImpl(sf: SourceFile): Promise<void> {
		return Promise.resolve();
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

	getTypeNode(type: Extract<LangNeutralType, 'intf' | 'impl' | 'json'>): TypeNode | Identifier | undefined {
		const n = this.getLangNode<Node>(type);
		if (n) {
			switch (type) {
				case 'intf':
				case 'impl':
					if (Node.isNamed(n)) {
						if (isIdentifiedLangNeutral(this))
							return n.getNameNode();
						switch (n.getKind()) {
							case SyntaxKind.TypeAliasDeclaration:
								return (n as TypeAliasDeclaration).getTypeNode();
							case SyntaxKind.EnumDeclaration:
								return (n as EnumDeclaration).getNameNode();
							default:
								throw new Error('Bad internal logic');
						}
					}
					else if (Node.isClassDeclaration(n))
						return n.getExtends();
					break;
				case 'json':
					if (Node.isVariableStatement(n)) {
						if (isIdentifiedLangNeutral(this))
							return n.getFirstDescendantByKind(SyntaxKind.VariableDeclaration)?.getNameNode() as Identifier;
					}
					break;
			}
		}
		return undefined;
	}

	override async genIntf(sf: SourceFile): Promise<Node<ts.NamedDeclaration>> {
		if (this.getLangNode('intf'))
			return this.getLangNode('intf');
		// primitive models are the one thing we can always construct even if we do not have a dedicated file for them.
		sf = await this.getSrcFile('INTF', sf.getProject(), sf);
		if (!sf)
			return Promise.resolve(undefined);
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

	override async genImpl(sf: SourceFile): Promise<ModelClassDeclaration> {
		if (this.getLangNode('impl'))
			return this.getLangNode('impl');
		sf = await this.getSrcFile('impl', sf.getProject(), sf);
		if (!sf)
			return Promise.resolve(null);
		const {id, fake} = this.ensureIdentifier('impl');
		let intf = this.getTypeNode('intf');
		if (!intf) {
			await this.genIntf(sf);
			intf = this.getTypeNode('intf');
		}
		let extTxt: string;
		switch (intf.getText()) {
			case 'number':
				extTxt = 'Number';
				break;
			case 'string':
				extTxt = 'String';
				break;
			case 'boolean':
				extTxt = 'Boolean';
				break;
			default:
				return Promise.resolve(null);
		}
		let retVal: ModelClassDeclaration = sf.getClass(id);
		if (!retVal) {
			retVal = this.bind('impl', sf.addClass({
				name: id,
				isExported: true,
				extends: extTxt
			}));
		}
		else if (!retVal.$ast)
			retVal = this.bind('impl', retVal);
		return retVal;
	}

	/*
		genJson(sf: SourceFile): Promise<ModelVariableStatement> {
			return Promise.resolve();
		}
	 */
}

@Injectable()
export class TsmorphArrayModel extends MixTsmorphModel<BaseArrayModel, ModelTypeAliasDeclaration, ModelTypeAliasDeclaration>(BaseArrayModel as any) {
	constructor(
		@Inject(BaseSettingsToken)
			baseSettings: BaseSettingsType,
		@Inject(TsMorphSettingsToken)
			tsMorphSettings: TsMorphSettingsType,
	) {
		super(baseSettings, tsMorphSettings);
	}

	getTypeNode(type: Extract<LangNeutralType, 'intf' | 'impl' | 'json'>): TypeNode | Identifier | undefined {
		const n = this.getLangNode<Node>(type);
		if (n) {
			switch (type) {
				case 'intf':
				case 'impl':
					if (Node.isTypeAliasDeclaration(n)) {
						if (isIdentifiedLangNeutral(this))
							return n.getNameNode();
						return n.getTypeNode();
					}
					break;
				case 'json':
					if (Node.isVariableStatement(n)) {
						if (isIdentifiedLangNeutral(this))
							return n.getFirstDescendantByKind(SyntaxKind.VariableDeclaration)?.getNameNode() as Identifier;
					}
					break;
			}
		}
		return undefined;
	}

	override addDependency(scope: 'intf' | 'impl' | 'json', sf: SourceFile, dependent: TsmorphModel, scopeOfDependent: Extract<LangNeutralType, 'intf' | 'impl' | 'json'>): void {
		super.addDependency(scope, sf, dependent, scopeOfDependent);
		if (isTsmorphModel(this.items))
			super.addDependency(scope, sf, this.items, scopeOfDependent);
	}

	override async genIntf(sf: SourceFile): Promise<ModelTypeAliasDeclaration> {
		if (this.getLangNode('intf'))
			return this.getLangNode('intf');
		sf = await this.getSrcFile('intf', sf.getProject(), sf);
		if (!sf)
			return Promise.resolve(null);
		if (isTsmorphModel(this.items)) {
			await this.items.genIntf(sf);
			super.addDependency('intf', sf, this.items, 'intf');
		}
		const {id, fake} = this.ensureIdentifier('intf');
		let retVal: ModelTypeAliasDeclaration = fake ? undefined : sf.getTypeAlias(id);
		if (!retVal) {
			retVal = this.bind('intf', sf.addTypeAlias({
				name: id,
				isExported: !fake,
				type: 'Array'
			}));
			if (isTsmorphModel(this.items)) {
				const itemsType = this.items.getTypeNode('intf');
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
		return retVal;
	}

	override async genImpl(sf: SourceFile): Promise<ModelTypeAliasDeclaration> {
		if (this.getLangNode('impl'))
			return this.getLangNode('impl');
		sf = await this.getSrcFile('impl', sf.getProject(), sf);
		if (!sf)
			return Promise.resolve(null);
		let itemsScope: Extract<LangNeutralType, 'intf' | 'impl'>;
		if (isTsmorphModel(this.items)) {
			await this.items.genImpl(sf);
			itemsScope = this.items.getLangNode('intf') ? 'intf' : 'impl';
			super.addDependency('impl', sf, this.items, itemsScope);
		}
		if (!sf)
			return Promise.resolve(null);
		const {id, fake} = this.ensureIdentifier('impl');
		let retVal: ModelTypeAliasDeclaration = fake ? undefined : sf.getTypeAlias(id);
		if (!retVal) {
			retVal = this.bind('impl', sf.addTypeAlias({
				name: id,
				isExported: !fake,
				type: 'Array'
			}));
			if (isTsmorphModel(this.items)) {
				const itemsType = this.items.getTypeNode(itemsScope);
				(retVal.getTypeNode() as TypeReferenceNode).addTypeArgument(itemsType.getText());
			}
			if (this.baseSettings.emitDescriptions) {
				const docs = this.getTypeNode('intf') ? <JSDocStructure>{
					kind: StructureKind.JSDoc,
					tags: [{
						kind: StructureKind.JSDocTag,
						tagName: 'inheritDoc'
					}]
				} : this.makeJsDoc();
				if (docs)
					retVal.addJsDoc(docs);
			}
		}
		else if (!retVal.$ast)
			retVal = this.bind('impl', retVal);
		return retVal;
	}

	async genJson(sf: SourceFile): Promise<ModelVariableStatement> {
		if (this.getLangNode('json'))
			return this.getLangNode('json');
		if (isTsmorphModel(this.items))
			await this.items.genJson(sf);
		return super.genJson(sf);
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

	getTypeNode(type: Extract<LangNeutralType, 'intf' | 'impl' | 'json'>): TypeNode | Identifier | undefined {
		const n = this.getLangNode<Node>(type);
		if (n) {
			switch (type) {
				case 'impl':
					if (Node.isClassDeclaration(n)) {
						if (isIdentifiedLangNeutral(this))
							return n.getNameNode();
					}
				// Fall-thru is intentional.  If this is not an isIdentifiedLangNeutral, then genImpl will have created an inline type interface declaration.
				case 'intf':
					if (Node.isInterfaceDeclaration(n)) {
						if (isIdentifiedLangNeutral(this))
							return n.getNameNode();
						// If this *object* is not named, we need to treat it as a literal type.
						let retVal: TypeNode = n.getFirstDescendantByKind(SyntaxKind.TypeLiteral);
						if (!retVal)
							retVal = n.getFirstDescendantByKind(SyntaxKind.TypeReference);
						return retVal;
					}
					else if (Node.isTypeAliasDeclaration(n)) {
						if (isIdentifiedLangNeutral(this))
							return n.getNameNode();
						return n.getTypeNode();
					}
					break;
				case 'json':
					if (Node.isVariableStatement(n)) {
						if (isIdentifiedLangNeutral(this))
							return n.getFirstDescendantByKind(SyntaxKind.VariableDeclaration)?.getNameNode() as Identifier;
					}
					break;
			}
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
		if (!sf)
			return Promise.resolve(null);
		const {id, fake} = this.ensureIdentifier('intf');
		let retVal: ModelInterfaceDeclaration = fake ? undefined : sf.getInterface(id);
		if (!retVal) {
			retVal = this.bind('intf', await this.createIntf(sf, id, fake, 'intf'));
			if (this.baseSettings.emitDescriptions && !fake) {
				const docs = this.makeJsDoc();
				if (docs)
					retVal.addJsDoc(docs);
			}
		}
		else if (!retVal.$ast)
			retVal = this.bind('intf', retVal);
		return retVal;
	}

	/**
	 * This method is shared for both interface creation and in rare scenarios for class "support".
	 * We can't generate a class without a name.
	 * If no name was provided (e.g. is fake), we create a fake interface, and use it's type (aka interface) in API params.
	 */
	private async createIntf(sf: SourceFile, id: string, fake: boolean, scope: 'intf' | 'impl'): Promise<InterfaceDeclaration | TypeAliasDeclaration> {
		let retVal: InterfaceDeclaration | TypeAliasDeclaration;
		let unionTxt = '';
		for (let u of this.unionOf) {
			if (isTsmorphModel(u)) {
				await u.genIntf(sf);
				this.addDependency(scope, sf, u, 'intf');
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
				this.addDependency(scope, sf, e, 'intf');
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
		return retVal;
	}

	private async genProperties(sf: SourceFile, ownerScope: 'intf' | 'impl', owner: ClassDeclaration | InterfaceDeclaration | TypeLiteralNode): Promise<void> {
		for (const [key, value] of Object.entries(this.properties)) {
			const propModel = value.model;
			if (!isTsmorphModel(propModel))
				continue;
			if (ownerScope === 'intf')
				await propModel.genIntf(sf);
			else
				await propModel.genImpl(sf);
			let propScope: 'intf' | 'impl' = 'intf';
			let propType = propModel.getTypeNode(propScope);
			if (ownerScope === 'impl') {
				if (!propType) {
					propScope = 'impl';
					propType = propModel.getTypeNode(propScope);    //URGENT: When propModel is [string, null], we could legitimately declare the property EVEN though there cannot be a impl class.
				}
			}
			this.addDependency(ownerScope, sf, propModel, propScope);
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
					const docs = propModel.makeJsDoc();
					if (docs)
						prop.addJsDoc(docs);
				}
			}
		}
		const ap = this.additionalProperties;
		if (ap && isTsmorphModel(ap)) {
			if (ownerScope === 'intf')
				await ap.genIntf(sf);
			else
				await ap.genImpl(sf);
			let propScope: 'intf' | 'impl' = 'intf';
			let propType = ap.getTypeNode(propScope);
			if (ownerScope === 'impl') {
				if (!propType) {
					propScope = 'impl';
					propType = ap.getTypeNode(propScope);
				}
			}
			this.addDependency(ownerScope, sf, ap, propScope);
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
					const docs = ap.makeJsDoc();
					if (docs)
						sig.addJsDoc(docs);
				}
			}
		}
	}

	override async genImpl(sf: SourceFile): Promise<ModelClassDeclaration> {
		/*
	The scenario described in genIntf gets more complicated for a class:
	type Person = NameAge & Origin & {race: string;} & (Contacts | Addresses);

	If all were interfaces, we would need to define all properties as declared in NameAge, Origin, and race.
	Then we would need to define all properties in Contacts and Addresses as optional (although perhaps overlaps could be marked required).
	Lastly we would need to provide type-guards for Contacts and Addresses.

	But if some (or all) were classes, it gets even more complicated.
	We might for instance define Person as having race and implementing Contacts and Addresses (with type-guards),
	but then we would have to mixin NameAge and Origin (assuming they were classes).
	The combinations of all these become quite overwhelming.
		 */
		if (this.getLangNode('impl'))
			return this.getLangNode('impl');
		sf = await this.getSrcFile('impl', sf.getProject(), sf);
		if (!sf)
			return Promise.resolve(null);
		const {id, fake} = this.ensureIdentifier('impl');
		let retVal: ModelClassDeclaration = fake ? undefined : sf.getClass(id);
		const intf = this.getLangNode('intf');
		if (fake) {
			if (intf)
				return Promise.resolve(null);
			retVal = this.bind('impl', await this.createIntf(sf, id, fake, 'impl'));
		}
		else {
			if (!retVal) {
				retVal = this.bind('impl', sf.addClass({
					name: id,
					isExported: true,
					implements: intf ? [intf.getName()] : undefined
				}));
				if (intf)
					this.addDependency('impl', sf, this, 'intf');
				if (Object.keys(this.properties).length > 0 || this.additionalProperties)
					await this.genProperties(sf, 'impl', retVal);
			}
			else if (!retVal.$ast)
				retVal = this.bind('impl', retVal);
		}
		return retVal;
	}

	async genJson(sf: SourceFile): Promise<ModelVariableStatement> {
		if (this.getLangNode('json'))
			return this.getLangNode('json');
		for (const [key, value] of Object.entries(this.properties)) {
			const propModel = value.model;
			if (!isTsmorphModel(propModel))
				continue;
			await propModel.genJson(sf);
		}
		const ap = this.additionalProperties;
		if (ap && isTsmorphModel(ap)) {
			await ap.genJson(sf);
		}
		return super.genJson(sf);
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

	getTypeNode(type: Extract<LangNeutralType, 'intf' | 'impl' | 'json'>): TypeNode | Identifier | undefined {
		const n = this.getLangNode<Node>(type);
		if (n) {
			switch (type) {
				case 'intf':
				case 'impl':    // both are type aliases
					if (Node.isTypeAliasDeclaration(n)) {
						if (isIdentifiedLangNeutral(this))
							return n.getNameNode();
						return n.getTypeNode();
					}
			}
		}
		return undefined;
	}

	override async genIntf(sf: SourceFile): Promise<ModelTypeAliasDeclaration> {
		if (this.getLangNode('intf'))
			return this.getLangNode('intf');
		sf = await this.getSrcFile('intf', sf.getProject(), sf);
		if (!sf)
			return Promise.resolve(null);
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

	override async genImpl(sf: SourceFile): Promise<ModelTypeAliasDeclaration> {
		if (this.getLangNode('impl'))
			return this.getLangNode('impl');
		sf = await this.getSrcFile('impl', sf.getProject(), sf);
		if (!sf)
			return Promise.resolve(null);
		const {id, fake} = this.ensureIdentifier('impl');
		let retVal: ModelTypeAliasDeclaration = fake ? undefined : sf.getTypeAlias(id);
		if (!retVal) {
			const intf = this.getTypeNode('intf');
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
		return retVal;
	}
}
