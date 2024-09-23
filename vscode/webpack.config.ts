import * as path from "path";
import * as webpack from "webpack";
//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

export default (env: any, argv: any) => {
  const mode = argv.mode || "none";
  const isDev = mode === "development";

  /** @type WebpackConfig */
  const extensionConfig: webpack.Configuration = {
    target: "node",
    mode: mode,
    entry: "./src/extension.ts",
    output: {
      path: path.resolve(__dirname, "out"),
      filename: "extension.js",
      libraryTarget: "commonjs2",
    },
    externals: {
      vscode: "commonjs vscode",
    },
    resolve: {
      extensions: [".ts", ".js"],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [
            {
              loader: "ts-loader",
            },
          ],
        },
      ],
    },
    devtool: "nosources-source-map",
    infrastructureLogging: {
      level: "log",
    },
  };

  const webviewConfig: webpack.Configuration = {
    target: "web",
    mode: mode,
    entry: "./src/webview/index.tsx",
    output: {
      filename: "[name].wv.js",
      path: path.resolve(__dirname, "out"),
    },
    resolve: {
      extensions: [".js", ".ts", ".tsx"],
    },
    module: {
      rules: [
        { test: /\.tsx?$/, use: ["babel-loader", "ts-loader"] },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
    devtool: isDev ? "inline-cheap-module-source-map" : false,
    watch: true,
    watchOptions: {
      ignored: /node_modules/,
      poll: 1000,
    },
  };

  return [webviewConfig, extensionConfig];
};
