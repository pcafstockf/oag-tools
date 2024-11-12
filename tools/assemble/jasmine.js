const path = require("node:path");
const jasmineMerge = require('../../scripts/jasmine-merge');

const jasminConf = jasmineMerge(
	"src",  // "spec_dir": All paths will become relative to this path.
	// Pull in the default config for node.
	path.join(__dirname, '../../jasmine.json5')
);
module.exports = jasminConf;
