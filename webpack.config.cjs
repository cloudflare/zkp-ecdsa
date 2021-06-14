module.exports = {
    entry: "./lib/src/index.js",
    target: "webworker",
    mode: "production",
    externals: { crypto: 'null' },
}
