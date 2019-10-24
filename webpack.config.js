const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { ProvidePlugin } = require("webpack");

const isDev = (process.env.NODE_ENV === "development");

module.exports = {
  mode: isDev ? "development" : "production",
  entry: {
    index: path.join(__dirname, "src", "index.js")
  },
  output: {
    path: path.join(__dirname, "dist"),
    filename: "[name].js",
    library: "OpenFPC",
    libraryExport: "default",
    libraryTarget: "commonjs2"
  },
  target: "electron-renderer",
  externals: {
    // we don't need to re-bundle everything: electron's renderer can require
    react: "react",
    "react-redux": "react-redux",
    three: "three",
    ajv: "ajv"
  },
  devtool: isDev ? "cheap-module-eval-source-map" : "cheap-source-map",
  module: {
    rules: [
      {
        exclude: /node_modules/,
        test: /(\.jsx$|\.js$)/,
        use: [
          "babel-loader"
        ]
      },
      {
        test: /\.less$/,
        use: [
          MiniCssExtractPlugin.loader,
          "css-loader",
          "less-loader"
        ]
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          "css-loader"
        ]
      },
      {
        test: /[^s][^d][^f]\.(jpg|png)$/,
        use: [{
          loader: "url-loader",
          options: {
            limit: 10000
          }
        }]
      },
      {
        test: /-sdf\.(fnt|png)$/,
        use: [
          "file-loader"
        ]
      },
      {
        test: /\.(woff|woff2)$/,
        use: [{
          loader: "file-loader",
          options: {
            name: "[name].[ext]",
            outputPath: "css/"
          }
        }]
      },
      {
        test: /\.(glsl|frag|vert)$/,
        exclude: /node_modules/,
        use: [
          "raw-loader"
        ]
      },
      {
        test: /\.(glsl|frag|vert)$/,
        exclude: /node_modules/,
        use: [
          "glslify-loader"
        ]
      },
      {
        test: /\.worker\.js$/,
        use: [
          {
            loader: "worker-loader",
            options: {
              name: "js/[name].js",
              // this violates the principle of exporting OpenFPC as a
              // free-standing library, but it sure makes for a hell of a
              // good demo
              publicPath: "../dist/"
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new ProvidePlugin({
      React: "react",
      THREE: "three"
    }),
    new MiniCssExtractPlugin({
      filename: "[name].css"
    }),
    new CopyWebpackPlugin([{ from: "src/vendor/wasm", to: "wasm" }]),
    process.env.ANALYZE_BUNDLE ?
      new BundleAnalyzerPlugin() :
      null
  ]
  .filter(notNull => notNull)
};
