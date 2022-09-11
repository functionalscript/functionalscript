/**
 * @typedef {{
 *  readonly execSync: (cmd: string) => Buffer
 * }} ChildProcess
 */

/** @typedef {{}} Buffer */

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

const { stringify, parse } = JSON

/** @type {<T>(node: Node<T>) => T} */
const version = ({ child_process, fs }) =>
    fs.writeFileSync(
        'package.json',
        stringify(
            {
                ...parse(fs.readFileSync('package.json').toString()),
                version: `0.0.${child_process.execSync('git log --oneline').toString().split('\n').length - 1}`
            },
            null,
            2))

module.exports = {
    /** @readonly */
    version,
}
