const pack = require('../../commonjs/package/module.f.cjs')

/** @type {(p: pack.PackageJson) => (b: Buffer) => string} */
const version = p => b => {
    const v = `0.0.${b.toString().split('\n').length}`
    return v
}

module.exports = {
    /** @readonly */
    version,
}
