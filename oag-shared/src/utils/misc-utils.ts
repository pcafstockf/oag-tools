import {omit as lodashOmit, transform as lodashTransform} from 'lodash';
import {constants, lstatSync, PathLike, Stats} from 'node:fs';
import {access} from 'node:fs/promises';


/**
 * Same as JavaScript's template literals, but use #{} instead of ${}.
 * This is useful because it allows us to mix the two representations into the same string :-)
 */
export function interpolateBashStyle(tmplStr: string, data: any): string | undefined {
	return tmplStr?.replace(/#{(.*?)}/g, (_, g) => data[g]);
}

/**
 * Same as fs.lstatSync, but never throws.
 * Returns undefined on failure.
 */
export function safeLStatSync(path: PathLike): Stats {
	try {
		return lstatSync(path) as any;
	}
	catch {
		return undefined as any;
	}
}

/**
 * Clone an object deeply while omitting the specified properties from the clone.
 */
export function omitDeep<T extends object, K extends (string | number | symbol | ((s: string | number | symbol) => string | number | symbol))>(obj: T, keysToOmit: K[]) {
	const staticKeys = keysToOmit.filter(k => typeof k !== 'function') as (string | number | symbol)[];
	const dynamicKeys = keysToOmit.filter(k => typeof k === 'function') as ((s: string | number | symbol) => string | number | symbol)[];
	const makeKeysFn = (obj: object) => {
		if (dynamicKeys.length === 0)
			return staticKeys;
		const keys = new Set<string | number | symbol>(staticKeys);
		dynamicKeys.forEach(fn => {
			Object.keys(obj).map(key => fn(key)).forEach(k => {
				if (k !== null && typeof k !== 'undefined')
					keys.add(k);
			});
		});
		return Array.from(keys.values());
	};

	function omitDeepInner<T extends object, K extends (string | number | symbol)>(obj: T) {
		return lodashTransform(lodashOmit(obj, makeKeysFn(obj)) as any, ((result: Record<K, any>, value: any, key: K) => {
			if (value && typeof value === 'object') {
				if (Array.isArray(value))
					result[key] = value.map(v => {
						if (v && typeof v === 'object')
							return omitDeepInner(lodashOmit(v, makeKeysFn(obj)));
						return v;
					});
				else
					result[key] = omitDeepInner(lodashOmit(value, makeKeysFn(obj)));
			}
			else {
				result[key] = value;
			}
		}) as any, {} as any) as T;
	}

	return omitDeepInner(obj);
}

/**
 * Determines if the given path is a local filesystem path.
 */
export async function isFileSystemPath(inputPath: string) {
	// Parse the input path to check if it's a URL
	try {
		const parsedUrl = new URL(inputPath);
		if (parsedUrl.protocol === 'file:')
			return true;
		// If it has a protocol and it's not file, it's not a filesystem path
		if (parsedUrl.protocol)
			return false;
	}
	catch (e) {
		// fall thru
	}
	// If there's no protocol, check if the path exists on the filesystem
	try {
		await access(inputPath, constants.F_OK);
		return true;
	}
	catch (e) {
		return false;
	}
}
