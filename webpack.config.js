const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require("mini-css-extract-plugin")
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
    entry: './app/src/index.js',
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [MiniCssExtractPlugin.loader, 'css-loader'],
            },
            {
                test: /\.(png|ico)$/i,
                use: [
                  {
                    loader: 'file-loader',
                    options: {
                        name: '[name].[ext]',
                    },
                  },
                ],
            },
            { test: /\.(js)$/, use: 'babel-loader' }
        ]
      },
    output: {
        path: path.resolve(__dirname, 'dist')
      },
    plugins: [
        new CopyPlugin({
          patterns: [
            { from: 'app/static/', to: 'static/' }
          ],
        }),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, './app/index.html'),
            filename: 'index.html',
        }),
        new MiniCssExtractPlugin(),
        new CleanWebpackPlugin(),
    ],
    devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development'
}