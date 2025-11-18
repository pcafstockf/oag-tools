// Provides access to embedded generator support/docs assets when bundled with webpack.
// Uses webpack's require.context to enumerate files under ../generators/**/(support|docs)/**

// Declare minimal typings to satisfy TS when using require.context
declare const require: any;

type Entry = { path: string; content: string };

function makeEntries(ctx: any): Entry[] {
	return ctx.keys().map((key: string) => {
		const mod = ctx(key);
		const content: string = (mod && (mod.default ?? mod)) as string;
		const norm = key.replace(/^\.\//, '');
		return {path: norm, content};
	});
}

// Build contexts for both support and docs directories
let entries: Entry[] = [];
try {
	const ctxSupport = require.context('./generators', true, /\/support\//);
	entries = entries.concat(makeEntries(ctxSupport));
}
catch {
}

try {
	const ctxDocs = require.context('./generators', true, /\/docs\//);
	entries = entries.concat(makeEntries(ctxDocs));
}
catch {
}

// Deduplicate in case of overlap
const entryMap: Map<string, string> = new Map();
for (const e of entries) {
	if (!entryMap.has(e.path)) entryMap.set(e.path, e.content);
}

function toPosix(p: string): string {
	return p.replace(/\\/g, '/');
}

// Given an absolute-ish srcDirName that contains "/generators/…", compute the manifest key prefix
function relBaseFromSrcDir(srcDirName: string): string | undefined {
	const posix = toPosix(srcDirName);
	let idx = posix.lastIndexOf('/generators/');
	if (idx >= 0) {
		return posix.substring(idx + '/generators/'.length);
	}
	// Fallback: try to split and find the last segment named 'generators'
	const parts = posix.split('/');
	const gi = parts.lastIndexOf('generators');
	if (gi >= 0) return parts.slice(gi + 1).join('/');
	return undefined;
}

export const supportManifest = {
	list(): string[] {
		return Array.from(entryMap.keys());
	},
	has(key: string): boolean {
		return entryMap.has(toPosix(key));
	},
	get(key: string): string | undefined {
		return entryMap.get(toPosix(key));
	},
	makeKeyFromSrc(srcDirName: string, relPath: string): string | undefined {
		const base = relBaseFromSrcDir(srcDirName);
		if (!base) return undefined;
		const key = `${toPosix(base).replace(/^\/+|\/+$/g, '')}/${toPosix(relPath).replace(/^\/+/, '')}`;
		return key;
	}
};
