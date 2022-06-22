const object = require('../../types/object/index.f.js')

/**
 * @template M
 * @typedef {{
 *  readonly at: (moduleId: string) => (moduleMap: M) => State | undefined
 *  readonly set: (moduleId: string) => (moduleState: State) => (moduleMap: M) => M
 * }} MapInterface
 */

/**
 * @typedef {|
 *  readonly['ok', Module] |
 *  readonly['error', Error]
 * } State
 */

/**
 * @typedef {{
 *  readonly exports: unknown
 *  readonly requireMap: object.Map<string>
 * }} Module
 */

/**
 * @typedef {|
 *  ['file not found'] |
 *  ['compilation error', unknown] |
 *  ['runtime error', unknown] |
 *  ['circular reference']
 * } Error
 */

/**
 * @typedef {{
 *  readonly package: string
 *  readonly path: readonly string[]
 * }} Id
 */

/** @type {(id: Id) => Id | undefined} */
const dir = id => {
    const len = id.path.length
    if (len < 1) { return undefined }
    return {
        package: id.package,
        path: id.path.slice(0, len - 1)
    }
}

/** @type {(id: Id) => string} */
const idToString = id => `${id.package}/${id.path.join('/')}`

module.exports = {
    /** @readonly */
    dir,
    /** @readonly */
    idToString,
}
