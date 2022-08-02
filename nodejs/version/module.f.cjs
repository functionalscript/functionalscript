const pack = require('../../commonjs/package/module.f.cjs')

/** 
 * @typedef {{
 *  readonly execSync: (cmd: string) => Buffer
 * }} ChildProcess
 */

/** @type {(p: pack.PackageJson) => (cp: ChildProcess) => string} */
const version = p => cp =>
    JSON.stringify({ ...p, version: `0.0.${cp.execSync('git log --oneline').toString().split('\n').length - 1}` }, null, 2)

module.exports = {
    /** @readonly */
    version,
}
