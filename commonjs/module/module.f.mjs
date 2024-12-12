// @ts-self-types="./module.f.d.mts"
import * as O from '../../types/object/module.f.mjs'

/**
 * @template M
 * @typedef {{
 *  readonly at: (moduleId: string) => (moduleMap: M) => State | null
 *  readonly setReplace: (moduleId: string) => (moduleState: State) => (moduleMap: M) => M
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
 *  readonly requireMap: O.Map<string>
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

/** @type {(id: Id) => Id | null} */
export const dir = id => {
    const len = id.path.length
    if (len < 1) { return null }
    return {
        package: id.package,
        path: id.path.slice(0, len - 1)
    }
}

/** @type {(id: Id) => string} */
export const idToString = id => `${id.package}/${id.path.join('/')}`
