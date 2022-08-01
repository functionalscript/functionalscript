const pack = require('../../commonjs/package/module.f.cjs')

/** @type {(p: pack.PackageJson) => (b: Buffer) => string} */
const version = p => b => 
    JSON.stringify({ ...p, version: `0.0.${b.toString().split('\n').length - 1}` }, null, 2)

module.exports = {
    /** @readonly */
    version,
}
