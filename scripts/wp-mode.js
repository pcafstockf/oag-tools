module.exports = (mode, fileName) => {
	switch (mode) {
		case 'development':
			if (typeof fileName === 'undefined')
				fileName = '[name].bundle.js';
			return {
				mode: 'development',
				devtool: 'inline-source-map',
				output: {
					filename: fileName
				},
				devServer: {}
			}
	}
	if (typeof fileName === 'undefined')
		fileName = '[name].[fullhash].bundle.js';
	return {
		mode: 'production',
		output: {
			filename: fileName,
		}
	}
}
