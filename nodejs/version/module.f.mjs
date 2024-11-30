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
 *  readonly fs: Fs<T>
 * }} Node
 */

const version = `0.1.600`

const { stringify, parse } = JSON

/** @type {<T>(node: Node<T>) => readonly[T, T]} */
const updateVersion = ({ fs }) => {
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
    version,
    updateVersion,
}
