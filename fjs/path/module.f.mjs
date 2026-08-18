/**
 * Path parsing and normalization helpers for portable module paths.
 *
 * @module
 *
 * @import { Fold, Reduce, Unary } from '../types/function/operator/types.ts'
 * @import { List } from '../types/list/types.ts'
 */

import { fold, last, take, length, concat as listConcat, toArray } from '../types/list/module.f.mjs'
import { join as listJoin, concat as stringConcat } from '../types/string/module.f.mjs'

/** @type {Fold<string, List<string>>} */
const foldNormalizeOp = input => state => {
    switch(input) {
        case '': case '.': { return state }
        case '..': {
            switch(last(undefined)(state)) {
                case undefined:
                case '..': { return listConcat(state)([input]) }
            }
            return take(length(state) - 1)(state)
        }
        default: { return listConcat(state)([input]) }
    }
}

/**
 * Converts Windows separators (`\`) to POSIX separators (`/`).
 *
 * @type {(path: string) => string}
 */
export const toPosix = path => path.replaceAll('\\', '/')

/**
 * Splits a path into normalized segments.
 *
 * Empty (`""`) and current-directory (`"."`) segments are removed, parent-directory
 * (`".."`) segments collapse the previous segment when possible, and Windows
 * separators are converted to POSIX separators.
 *
 * @type {(path: string) => readonly string[]}
 */
export const parse = path => {
    const split = toPosix(path).split('/')
    return toArray(fold(foldNormalizeOp)([])(split))
}

/**
 * Normalizes a path string by parsing and rejoining it with POSIX separators.
 *
 * @type {Unary<string, string>}
 */
export const normalize = path => {
    const foldResult = parse(path)
    return listJoin('/')(foldResult)
}

/**
 * Concatenates two path fragments and returns a normalized path.
 *
 * @type {Reduce<string>}
 */
export const concat = a => b => {
    const s = stringConcat([a, '/', b])
    return normalize(s)
}

/**
 * Joins path segments with single POSIX `/` separators, without
 * normalization. Unlike {@link concat}, the result is not parsed/collapsed,
 * so absolute roots and `.`/`..` segments are preserved verbatim. Use this
 * for building paths from already-clean segments (directory walks, store
 * layouts); use {@link concat} when normalization is desired.
 *
 * @type {(...list: readonly string[]) => string}
 */
export const join = (...list) => list.join('/')

/**
 * Returns `path` relative to `base` with a `./` prefix, or `path` unchanged
 * if it does not start with `base` or `base` is empty.
 * E.g. `relativize('/repo', '/repo/fs/a.ts')` → `'./fs/a.ts'`.
 *
 * @type {(base: string, path: string) => string}
 */
export const relativize = (base, path) =>
    base !== '' && path.startsWith(base) ? `.${path.slice(base.length)}` : path

/**
 * Returns `true` when `prefix` is a strict ancestor of `path` in segment space:
 * every segment of `prefix` matches the corresponding segment of `path`, and
 * `path` has at least one additional segment.
 *
 * @type {(prefix: readonly string[], path: readonly string[]) => boolean}
 */
export const isProperPrefix = (prefix, path) =>
    prefix.length < path.length && prefix.every((seg, i) => seg === path[i])
