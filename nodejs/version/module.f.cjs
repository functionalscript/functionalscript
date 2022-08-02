const pack = require('../../commonjs/package/module.f.cjs')

/** 
 * @typedef {{
 *  readonly execSync: (cmd: string) => Buffer
 * }} ChildProcess
 */

/**
 * @template T
 * @typedef {{
 *  readonly readFileSync: (name: string) => Buffer
 *  readonly writeFileSync: (name: string, content: string) => T
 * }} Fs
 */

/** @type {<T>(fs: Fs<T>) => (cp: ChildProcess) => T} */
const version = fs => cp =>
    fs.writeFileSync(
        'package.json',
        JSON.stringify(
            {
                ...JSON.parse(fs.readFileSync('package.json').toString()), 
                version: `0.0.${cp.execSync('git log --oneline').toString().split('\n').length - 1}` 
            }, 
            null, 
            2))

module.exports = {
    /** @readonly */
    version,
}
