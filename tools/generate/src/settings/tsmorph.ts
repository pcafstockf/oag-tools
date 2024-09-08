import {InjectableId} from 'async-injection';
import {RegisterConfigMarker} from 'dyflex-config';
import {FormatCodeSettings, IndentationText, NewLineKind, QuoteKind, ScriptTarget} from 'ts-morph';

export const TsMorphSettings = {
	[RegisterConfigMarker]: 'CODE_GEN_TSMORPH',

	format: {
		tabSize: 4,
		indentSize: 4,
		indentStyle: 2, // IndentStyle.Smart,
		trimTrailingWhitespace: true,
		insertSpaceAfterCommaDelimiter: true,
		insertSpaceAfterSemicolonInForStatements: true,
		insertSpaceBeforeAndAfterBinaryOperators: true,
		insertSpaceAfterConstructor: true,
		insertSpaceAfterKeywordsInControlFlowStatements: true,
		insertSpaceAfterFunctionKeywordForAnonymousFunctions: true,
		insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis: false,
		insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets: false,
		insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
		insertSpaceAfterOpeningAndBeforeClosingEmptyBraces: false,
		insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces: false,
		insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces: false,
		insertSpaceAfterTypeAssertion: true,
		insertSpaceBeforeFunctionParenthesis: false,
		placeOpenBraceOnNewLineForFunctions: false,
		placeOpenBraceOnNewLineForControlBlocks: false,
		insertSpaceBeforeTypeAnnotation: false,
		indentMultiLineObjectLiteralBeginningOnBlankLine: true,
		semicolons: 'insert' as any, // SemicolonPreference.Insert,
		ensureNewLineAtEndOfFile: true
	} as FormatCodeSettings,
	project: {
		manipulationSettings: {
			indentationText: IndentationText.Tab,
			newLineKind: NewLineKind.LineFeed,
			quoteKind: QuoteKind.Single,
		},
		compilerOptions: {
			outDir: undefined as string,
			target: ScriptTarget.ES2021
		}
	}
};

export type TsMorphSettingsType = Omit<typeof TsMorphSettings, '__conf_register'>;
export const TsMorphSettingsToken = Symbol.for(TsMorphSettings[RegisterConfigMarker]) as InjectableId<TsMorphSettingsType>;
