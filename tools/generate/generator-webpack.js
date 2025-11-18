const path = require('path');
const {merge} = require('webpack-merge');

const baseConfigFn = require(path.resolve('scripts', 'wp-common'));
const modeConfigFn = require(path.resolve('scripts', 'wp-mode'));

// Exclude any files under a "support" or "docs" directory from ts-loader so they can be treated as raw assets.
const tsExclude = (fp) => {
	const sep = path.sep;
	if (fp.includes(`${sep}support${sep}`) || fp.includes(`${sep}docs${sep}`)) return true;
	return /node_modules/.test(fp);
};

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
	module: {
		rules: [
			// Treat any files under generators/**/(support|docs)/** as text assets embedded into the bundle
			{
				test: /\.(ts|js|json|txt|md|hbs|tmpl|handlebars|yml|yaml)$/i,
				include: (fp) => fp.includes(`${path.sep}generators${path.sep}`) && (fp.includes(`${path.sep}support${path.sep}`) || fp.includes(`${path.sep}docs${path.sep}`)),
				type: 'asset/source',
			},
		],
	},
};

const tsconfigFilePath = process.env.TS_NODE_PROJECT || path.resolve(__dirname, 'tsconfig.json');
module.exports = merge(
	baseConfigFn(tsconfigFilePath, undefined, tsExclude),
	modeConfigFn('development', 'generator.js'),
	config
);
