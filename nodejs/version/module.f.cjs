const pack = require('../../commonjs/package/module.f.cjs')

/** @type {(p: pack.PackageJson) => (b: Buffer) => string} */
const version = p => b => {
    const v = `0.0.${b.toString().split('\n').length}`
    return JSON.stringify({ ...p, version: v }, null, 2)
}

module.exports = {
    /** @readonly */
    version,
}
