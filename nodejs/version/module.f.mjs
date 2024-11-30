import p from '../../package.d.mjs'
const { version } = p

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

/** @type {<T>(node: Node<T>) => readonly[T, T]} */
const updateVersion = ({ fs }) => {
    const jsonFile = (/** @type {string} */jsonFile) => `${jsonFile}.json`
    const readJson = (/** @type {string} */name) => parse(fs.readFileSync(jsonFile(name)).toString())
    const f = (/** @type {string} */name) => {
        const file = `${jsonFile}.json`
        return fs.writeFileSync(
            jsonFile(name),
            stringify(
                {
                    ...readJson(name),
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

    updateVersion,
}
