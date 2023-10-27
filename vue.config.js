const { defineConfig } = require('@vue/cli-service')
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
module.exports = defineConfig({
  transpileDependencies: true,
  configureWebpack: {
    //js output config
    output: {
      filename: 'js/[name]-js-out.js',
      chunkFilename: 'js/[name]-chunk-vendors-out.js'
    },
		// css output config
    plugins: [
      new MiniCssExtractPlugin({
        filename: `css/[name]-css-out.css`,
        chunkFilename: `css/[name]-chunk-vendors-out.css`,
        // chunkFilename: `css/[name].${conf.version}.css`
      })
    ],
    module:{
      rules:[
        {test:/\.ts$/,use:'ts-loader'}
      ]
    }
  }

})
