//@ts-check
'use strict';

const path = require('path');

/**@type {import('webpack').Configuration}*/
const extension = {
	target: 'node',
	mode: 'none',
	entry: './src/extension/extension.ts',
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'extension.js',
		libraryTarget: 'commonjs2',
	},
	devtool: 'nosources-source-map',
	externals: {
		vscode: 'commonjs vscode',
	},
	resolve: {
		extensions: ['.ts', '.js'],
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [{ loader: 'ts-loader' }],
			},
		],
	},
};

const webview = {
	target: 'web',
	mode: 'none',
	entry: './src/webview/webview/webview.ts',
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'webview.js',
		devtoolModuleFilenameTemplate: '../[resource-path]',
	},
	devtool: 'source-map',
	resolve: {
		extensions: ['.ts', '.js'],
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [{ loader: 'ts-loader' }],
			},
			{
				test: /\.css$/,
				use: ['style-loader', 'css-loader'],
			},
		],
	},
};

const proxyView = {
	target: 'web',
	mode: 'none',
	entry: './src/webview/proxyView/proxyView.ts',
	output: {
		path: path.resolve(__dirname, 'dist'),
		filename: 'proxyView.js',
		devtoolModuleFilenameTemplate: '../[resource-path]',
	},
	devtool: 'source-map',
	resolve: {
		extensions: ['.ts', '.js'],
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [{ loader: 'ts-loader' }],
			},
			{
				test: /\.css$/,
				use: ['style-loader', 'css-loader'],
			},
		],
	},
};

module.exports = [extension, webview, proxyView];
