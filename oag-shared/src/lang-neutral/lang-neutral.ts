export const LangNeutralTypes = ['intf', 'impl', 'json', 'hndl', 'mock'] as const;
export type LangNeutralType = typeof LangNeutralTypes[number];

/**
 * Not all generated elements are OpenAPI based.
 * Some are synthetically constructed by the generator.
 */
export interface LangNeutral {
	getLangNode(type: LangNeutralType): unknown;
}

export const CodeGenAst = Symbol('code-gen-ast');
export type OpenApiLangNeutralBackRef<AST> = { [CodeGenAst]: AST }

export interface OpenApiLangNeutral<OAE, AST> {
	/**
	 * Return the underlying OpenApi Element.
	 * The OpenAPI element will have a backlink (aka reference) to its CodeGenAst (aka LangNeutral).
	 */
	readonly oae: OAE & OpenApiLangNeutralBackRef<AST>;
}

export function isOpenApiLangNeutral<OAE, LN>(obj: unknown): obj is OpenApiLangNeutral<OAE, LN> {
	if ((obj as any).oae && typeof (obj as any).oae === 'object')
		if (((obj as any).oae)[CodeGenAst] === obj)
			return true;
	return false;
}

export interface IdentifiedLangNeutral {
	/**
	 * For types the 'identifier' is the type name.
	 * e.g. 'number', 'Foo', 'string[]', 'Foo[]', 'FooArray' (as an alias for "type FooArray = Foo[];").
	 * NOTE:
	 * If there is title or x-schema-name attribute, this name *may* be undefined.
	 * However, names that can be manufactured will be attempted (getFooBarRequest, postBazBif201Response, etc.).
	 */
	getIdentifier(type: LangNeutralType): string | undefined;
}

export function isIdentifiedLangNeutral(obj: unknown): obj is IdentifiedLangNeutral {
	if (typeof (obj as IdentifiedLangNeutral).getIdentifier === 'function')
		if ((obj as IdentifiedLangNeutral).getIdentifier(null))
			return true;
	return false;
}

export interface FileBasedLangNeutral extends IdentifiedLangNeutral {
	/**
	 * Where is this model located (relative to the output directory).
	 * NOTE:
	 *  This method does not necessarily return the "containing" source file for this schema.
	 *  Obviously it is in *some* source file, but if getIdentifier returns undefined, so will this method.
	 * @see getIdentifier
	 */
	getFilepath(type: LangNeutralType): string | undefined;
}

export function isFileBasedLangNeutral(obj: unknown): obj is FileBasedLangNeutral {
	if (typeof (obj as FileBasedLangNeutral).getFilepath === 'function')
		if ((obj as FileBasedLangNeutral).getFilepath(null))
			return true;
	return false;
}

export type MixinConstructor<T = {}> = new (...args: any[]) => T;
