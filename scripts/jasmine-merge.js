const path = require('node:path');
const fs = require('node:fs');
const lodash = require('lodash');

const customMerger = (o, s) => {
	if (Array.isArray(o)) return lodash.union(o, s);
}

/**
 * Starting with a traditional jasmine 'spec_dir' (always relative to the cwd),
 * this function takes additional jasmine.js or jasmine.json(5) files and merges
 * them all together, adjusting paths in each file that it merges, to be relative to
 * the 'spec_dir' that is passed in as the first argument to this function.
 * The return value may be assigned to module.exports if you are using the jasmine.js
 * approach, or written to a json file.
 * Arguments 1..n may be either a string path to a jasmine configuration file, or an
 * actual jasmine configuration object.
 * Regardless of what is any all other files, the returned object will have its 'spec_dir'
 * property set to the first argument that was passed to this function, as that should
 * **always** be what all paths in the configuration are relative to upon completion
 * of this function.
 */
module.exports = (spec_dir, ...inputs) => {
	const anchorDir = spec_dir;
	let JSONParse = JSON.parse;
	try {
		JSONParse = require('json5').parse;
	} catch (e) {
		// Its' okay if we cannot load json5
	}
	let result = {};
	if (Array.isArray(inputs))
		result = inputs.reduce((p, fp, idx) => {
			let f;
			let localAnchor;
			if (typeof fp === 'string') {
				const fd = path.dirname(fp);
				localAnchor = path.relative(anchorDir, fd);
				if (path.extname(fp) === '.js')
					f = require(fp);
				else
					f = JSONParse(fs.readFileSync(fp, 'utf8'));
			} else
				f = fp;
			if (f.spec_dir)
				localAnchor = path.relative(localAnchor, f.spec_dir);
			if (Array.isArray(f.helpers))
				f.helpers = f.helpers.map(e => path.join(localAnchor, e));
			if (Array.isArray(f.spec_files))
				f.spec_files = f.spec_files.map(e => path.join(localAnchor, e));
			lodash.mergeWith(p, f, customMerger);
			return p;
		}, {spec_files: [], helpers: []});
	result.spec_dir = spec_dir;
	return result;
}
