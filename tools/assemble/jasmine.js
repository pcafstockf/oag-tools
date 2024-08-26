const path = require("node:path");
const jasmineMerge = require('../../../scripts/jasmine-merge');

/**
 * We perform tests on the mail parsers as transformation relies on that.
 */
const jasminConf = jasmineMerge(
	"src",  // "spec_dir": All paths will become relative to this path.
	// Pull in the default config for node.
	path.join(__dirname, '../../jasmine.json5'),
	// Pull in the tests for the mail parsing.
	path.join(__dirname, '../../lib/mail/jasmine.json5')
);
module.exports = jasminConf;
