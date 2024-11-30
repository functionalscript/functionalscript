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

/** @type {<T>(node: Node<T>) => readonly[T, T]} */
const version = ({ child_process, fs }) => {
    const version = `0.1.${child_process.execSync('git log --oneline').toString().split('\n').length - 1}`
    const f = (/** @type {string} */jsonFile) => {
        const file = `${jsonFile}.json`
        return fs.writeFileSync(
            file,
            stringify(
                {
                    ...parse(fs.readFileSync(file).toString()),
                    version
                },
                null,
                2))
    }
    return [
        f('package'),
        f('jsr')
    ]
}

export default {
    /** @readonly */
    version,
}
