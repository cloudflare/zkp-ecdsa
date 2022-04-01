export default {
    entry: "./lib/src/index.js",
    mode: "production",
    externals: { crypto: 'null' },
    optimization: { minimize: false },
}
