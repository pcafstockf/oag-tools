const path = require('path');
const {merge} = require('webpack-merge');

const baseConfigFn = require(path.resolve('scripts', 'wp-common'));
const modeConfigFn = require(path.resolve('scripts', 'wp-mode'));
const config = {
	entry: path.join(__dirname, 'src/uplift-schema.ts'),
	target: 'node',
	output: {
		path: path.resolve('dist', 'plugins'),
		libraryTarget: 'commonjs2',
	},
};

const tsconfigFilePath = process.env.TS_NODE_PROJECT || path.resolve(__dirname, 'tsconfig.json');
module.exports = merge(
	baseConfigFn(tsconfigFilePath),
	modeConfigFn('development', 'uplift-schema.js'),
	config
);
