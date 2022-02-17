const object = require('../../types/object')

/**
 * @template M
 * @typedef {{
 *  readonly at: (moduleId: string) => (moduleMap: M) => State | undefined
 *  readonly insert: (moduleId: string) => (moduleState: State) => (moduleMap: M) => M
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

/** @type {(id: Id) => string} */
const idToString = id => `${id.package}/${id.path.join('/')}`

module.exports = {
    /** @readonly */
    idToString,
}
