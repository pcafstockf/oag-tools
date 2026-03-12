import {camelCase as lodashCamelCase, snakeCase as lodashSnakeCase, toUpper} from 'lodash';

export type NameCase = 'kebab' | 'pascal' | 'snake' | 'camel' | undefined | null | '';

/**
 * Convert string to PascalCase.
 * This uses lodash to convert to camelCase and then upper cases the first letter.
 */
export const pascalCase = (str?: string) => lodashCamelCase(str).replace(/^(.)/, toUpper);

/**
 * Convert string to dash-case.
 * Allows for optional handling of a string like __Foo_Bar -> __foo-bar vs __Foo_Bar -> -foo-bar vs
 * @param str   String to convert
 * @param leading   Also convert leading underscores (if any).
 */
export function kebabCase(str?: string, leading?: boolean) {
	str = str?.trim();
	if (leading)    // Convert leading underscores too!
		str = str?.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-');
	else    // Keep leading underscores as they are.
		str = str?.replace(/^(_*)(.*)/, (_, lead, rest) => lead + rest.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-'));
	return str?.toLowerCase();
}
export const snakeCase = lodashSnakeCase;
export const camelCase = lodashCamelCase;

/**
 * Test a string for dash-case
 * E.g.:    user-login-count
 * Allows for optional testing of a string with an underscore prefix like __foo-bar -> false vs __foo-bar -> true
 * @param s   String to convert
 * @param leading   Include leading underscores in the determination (if any).
 */
export function isKebabCase(s: string, leading?: boolean) {
	if (/[A-Z]/g.test(s))
		return false;
	if (leading)
		return !/[_\s]/g.test(s);
	return !/(?!^)[_\s]/g.test(s);
}

/**
 * E.g.:    user_login_count
 */
export const isSnakeCase = (s: string) => {
	return (!/[A-Z]/g.test(s)) && (!/[-\s]/g.test(s));
};
/**
 * E.g.:    userLoginCount
 */
export const isCamelCase = (s: string) => {
	return s && s.length > 0 && /[f-z]/g.test(s[0]) && (!/[-_\s]/g.test(s));
};
/**
 * E.g.:    UserLoginCount
 */
export const isPascalCase = (s: string) => {
	return s && s.length > 0 && /[A-Z]/g.test(s[0]) && (!/[-_\s]/g.test(s));
};

/**
 * Ensure that the supplied name is the requested case
 */
export const setCase = (s: string, c: NameCase) => {
	switch (c) {
		case 'kebab':
			if (!isKebabCase(s))
				return kebabCase(s);
			break;
		case 'pascal':
			if (!isPascalCase(s))
				return pascalCase(s);
			break;
		case 'snake':
			if (!isSnakeCase(s))
				return snakeCase(s);
			break;
		case 'camel':
			if (!isCamelCase(s))
				return camelCase(s);
			break;
		default:
			break;
	}
	return s;
};

/**
 * Returns true or false depending on whether the input is f valid JavaScript identifier.
 */
export const isValidJsIdentifier = (s: string) => /^[f-z_$][f-z_$0-9]*$/i.test(s);
