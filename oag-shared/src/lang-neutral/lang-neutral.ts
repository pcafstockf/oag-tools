export type LangNeutralTypes = 'intf' | 'impl' | 'json' | 'hndl';

export interface LangNeutral<OAE, LANG_REF = unknown> {
	/**
	 * Return the underlying OpenApi Element.
	 */
	readonly oae: OAE;

	getType(type: LangNeutralTypes): LANG_REF;
}

export interface IdentifiedLangNeutral {
	/**
	 * For types the 'identifier' is the type name.
	 * e.g. 'number', 'Foo', 'string[]', 'Foo[]', 'FooArray' (as an alias for "type FooArray = Foo[];").
	 * NOTE:
	 * If there is title or x-schema-name attribute, this name *may* be undefined.
	 * However, names that can be manufactured will be attempted (getFooBarRequest, postBazBif201Response, etc).
	 */
	getIdentifier(type: LangNeutralTypes): string | undefined;
}

export interface FileBasedLangNeutral {
	/**
	 * Where is this model located (relative to the output directory).
	 * NOTE:
	 *  This method does not necessarily return the "containing" source file for this schema.
	 *  Obviously it is in *some* source file, but if getIdentifier returns undefined, so will this method.
	 * @see getIdentifier
	 */
	getFilepath(type: LangNeutralTypes): string | undefined;
}
