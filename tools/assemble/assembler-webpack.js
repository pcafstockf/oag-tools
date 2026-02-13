const path = require('path');
const {merge} = require('webpack-merge');

const baseConfigFn = require(path.resolve('scripts', 'wp-common'));
const modeConfigFn = require(path.resolve('scripts', 'wp-mode'));

const config = {
	entry: path.join(__dirname, 'src/main.ts'),
	target: 'node',
	output: {
		path: path.resolve('dist'),
		libraryTarget: 'commonjs2',
	},
	resolve: {
		alias: {
			// Force CommonJS build of json5 to avoid mixed ESM/CJS interop issues
			json5$: require.resolve('json5/dist/index.js'),
		},
	},
};

const tsconfigFilePath = process.env.TS_NODE_PROJECT || path.resolve(__dirname, 'tsconfig.json');
module.exports = merge(
	baseConfigFn(tsconfigFilePath),
	modeConfigFn('development', 'assembler.js'),
	config
);
