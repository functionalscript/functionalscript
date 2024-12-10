// @ts-self-types="./module.f.d.mts"

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

const { stringify, parse } = JSON

/** @type {<T>(fs: Fs<T>) => string} */
const getVersion = fs => readJson(fs)('package').version

const jsonFile = (/** @type {string} */jsonFile) => `${jsonFile}.json`

/** @type {<T>(node: Fs<T>) => (name: string) => any} */
const readJson = fs => name => parse(fs.readFileSync(jsonFile(name)).toString())

/** @type {<T>(node: Node<T>) => readonly[T, T]} */
const updateVersion = ({ fs }) => {
    const f = (/** @type {string} */name) => {
        return fs.writeFileSync(
            jsonFile(name),
            stringify(
                {
                    ...readJson(fs)(name),
                    version: getVersion(fs)
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
    getVersion,
    updateVersion,
}
