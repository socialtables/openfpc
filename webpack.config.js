const path = require("path");
const webpack = require("webpack");
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const UglifyJSPlugin = require("uglifyjs-webpack-plugin");

// build variant for electron renderer
const isDev = (process.env.NODE_ENV === "development");
module.exports = {
  mode: isDev ? "development" : "production",
  entry: {
    // slurp up index.js as "index", so we get "index" out
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
    // we don't need to re-bundle everything, electron's renderer can require
    react: "react",
    "react-redux": "react-redux",
    three: "three",
    ajv: "ajv"
  },
  devtool: isDev ? "cheap-module-eval-source-map" : "source-map",
  module: {
    rules: [
      {
        exclude: /node_modules/,
        test: /(\.jsx$|\.js$)/,
        use: {
          loader: "babel-loader"
        }
      },
      {
        test: /\.less$/,
        loader: ExtractTextPlugin.extract({
          fallback: "style-loader",
          use: ["css-loader", "less-loader"]
        })
      },
      {
        test: /\.css$/,
        loader: ExtractTextPlugin.extract({
          fallback: "style-loader",
          use: ["css-loader"]
        })
      },
      {
        test: /[^s][^d][^f]\.(jpg|png)$/,
        loader: "url-loader?limit=10000"
      },
      {
        test: /-sdf\.(fnt|png)$/,
        loader: "file-loader"
      },
      {
        test: /\.(woff|woff2)$/,
        loader: "file-loader",
        options: {
          outputPath: "css/"
        }
      },
      {
        test: /\.(glsl|frag|vert)$/,
        loader: "raw-loader",
        exclude: /node_modules/
      },
      {
        test: /\.(glsl|frag|vert)$/,
        loader: "glslify-loader",
        exclude: /node_modules/
      }
    ]
  },
  plugins: [
    new webpack.ProvidePlugin({
      React: "react",
      THREE: "three"
    }),
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify(isDev ? "development" : "production"),
      "process.env.DEBUG": `(process ? process.env.DEBUG : null) || ${JSON.stringify(process.env.DEBUG)}`,
      "window.__DEV__": isDev ? "true" : "false"
    }),
    new ExtractTextPlugin("[name].css", { allChunks: true }),
    !isDev && new UglifyJSPlugin({ include: /\.min\.js$/ })
  ]
  .filter(p => p)
};
