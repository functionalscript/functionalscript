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

/**
 * @template T
 * @typedef {{
 *  readonly child_process: ChildProcess
 *  readonly fs: Fs<T>
 * }} Node
 */

/** @type {<T>(node: Node<T>) => T} */
const version = ({ child_process, fs }) =>
    fs.writeFileSync(
        'package.json',
        JSON.stringify(
            {
                ...JSON.parse(fs.readFileSync('package.json').toString()), 
                version: `0.0.${child_process.execSync('git log --oneline').toString().split('\n').length - 1}` 
            }, 
            null, 
            2))

module.exports = {
    /** @readonly */
    version,
}