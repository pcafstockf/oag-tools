// noinspection NpmUsedModulesInstalled
const webpack = require('webpack');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

/**
 * Returns a common "base" webpack configuration.
 * @param tsconfigFilePath  This must be a valid path to the tsconfig.json file you wish ts-loader to use.
 * @param preDefines    A Record<string,string object to be passed to the webpack.DefinePlugin (defaults to undefined).
 * @param tsnodeExclude Controls which files are *not* processed by TypeScript before being passed to webpack. (defaults to /node_modules/).
 * 			If your target is es5, you probably need to change this property from its default value.
 * 			If any of the packages you depend on (aka node_modules) are es6+, they need to be down-leveled to es5.
 * 			This is historically done with Babel, but since all valid JavaScript is also valid TypeScript, we can simply run es6+ code through TypeScript to downlevel it.
 * 			This is inspired by the combination of:
 * 				https://stackoverflow.com/questions/53154986/babel-not-transpiling-imported-node-modules-to-es5-includes-es2015-syntax
 * 				https://webpack.js.org/configuration/module/#condition
 * 			You will want a function something like:
 * 				tswpConfig.tsnodeExclude = function(path) {
 * 					const nonEs5SyntaxPackages = ['react-router'];  // has some 'let' variables.
 * 					if (nonEs5SyntaxPackages.some( pkg => path.match(pkg)))
 * 						return false;
 * 					return path.match("node_modules");  // otherwise node_modules should *not* be run through TypeScript.
 * 				}
 */
module.exports = (tsconfigFilePath, preDefines, tsnodeExclude) => {
	if (typeof tsnodeExclude === 'undefined')
		tsnodeExclude = /node_modules/;
	let retVal = {
		optimization: {
			splitChunks: false,
			runtimeChunk: false,
		},
		module: {
			rules: [
				{
					test: /\.js$/,
					enforce: "pre",
					loader: "source-map-loader"
				},
				{
					test: /\.(js|mjs|jsx|ts|mts|tsx)$/,
					use: [{
						loader: 'ts-loader',
						options: {
							transpileOnly: true,    // No need to slow down if we are using a real IDE.
							configFile: tsconfigFilePath
						}
					}],
					exclude: tsnodeExclude
				}]
		},
		plugins: [],
		resolve: {
			modules: [
				'node_modules'
			],
			extensions: ['.tsx', '.ts', '.jsx', '.js'],
			plugins: [
				new TsconfigPathsPlugin({configFile: tsconfigFilePath}),
			]
		}
	}

	if (preDefines && Object.keys(preDefines).length > 0) {
		// noinspection JSUnresolvedReference
		retVal.plugins.unshift(new webpack.DefinePlugin(preDefines));
	}
	return retVal;
}
