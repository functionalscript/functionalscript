/**
 * Path parsing and normalization helpers for portable module paths.
 *
 * A path is a {@link root} followed by segments. The root is what makes the
 * path absolute — `/`, or `//` for a UNC share — and it is not a segment:
 * it survives normalization, and `..` cannot escape it. Everything after it
 * folds by the usual rules, so `a//b` is `a/b` and `a/../b` is `b`.
 *
 * @module
 *
 * @import { Fold, Reduce, Unary } from '../types/function/operator/types.ts'
 * @import { List } from '../types/list/types.ts'
 */

import { fold, last, take, length, concat as listConcat, toArray } from '../types/list/module.f.mjs'
import { join as listJoin, concat as stringConcat } from '../types/string/module.f.mjs'

/**
 * `rooted` is the only thing the fold needs to know about the root: whether a
 * leading `..` has anywhere to go. `/a/../..` is `/`, because there is no
 * parent of the root to name, while `a/../..` stays `..`.
 *
 * @type {(rooted: boolean) => Fold<string, List<string>>}
 */
const foldNormalizeOp = rooted => input => state => {
    switch(input) {
        case '': case '.': { return state }
        case '..': {
            switch(last(undefined)(state)) {
                case undefined: { return rooted ? state : listConcat(state)([input]) }
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
 * The root marker of an already-POSIX path, and the segment fold over one.
 * Both take a path {@link toPosix} has already been applied to, so a public
 * entry point converts its arguments once and every step below reads the same
 * separators.
 *
 * @type {(p: string) => string}
 */
const posixRoot = p => {
    if (!p.startsWith('/')) { return '' }
    return p.startsWith('//') && !p.startsWith('///') ? '//' : '/'
}

/** @type {(rooted: boolean) => (p: string) => readonly string[]} */
const posixSegments = rooted => p => toArray(fold(foldNormalizeOp(rooted))([])(p.split('/')))

/** @type {(r: string) => (p: string) => string} */
const rejoin = r => p => stringConcat([r, listJoin('/')(posixSegments(r !== '')(p))])

/**
 * The root marker of a path: `'//'` for a UNC path, `'/'` for a POSIX
 * absolute path, and `''` for a relative one.
 *
 * Exactly two leading slashes are a UNC root — `//server/share`, the form
 * POSIX leaves implementation-defined and Windows spells `\\server\share`.
 * Three or more are an ordinary root with empty segments after it, which is
 * what POSIX requires. A Windows drive letter needs no case of its own: `C:`
 * is already a non-empty segment and survives the fold unchanged.
 *
 * @type {(path: string) => string}
 */
export const root = path => posixRoot(toPosix(path))

/**
 * Splits a path into normalized segments, *without* its root — `parse('/a/b')`
 * and `parse('a/b')` are both `['a', 'b']`. Use {@link root} to ask whether the
 * path was absolute, or {@link normalize} for a string that keeps it.
 *
 * Empty (`""`) and current-directory (`"."`) segments are removed, parent-directory
 * (`".."`) segments collapse the previous segment when possible, and Windows
 * separators are converted to POSIX separators. A `".."` that would escape a
 * root is dropped rather than kept.
 *
 * @type {(path: string) => readonly string[]}
 */
export const parse = path => {
    const p = toPosix(path)
    return posixSegments(posixRoot(p) !== '')(p)
}

/**
 * Normalizes a path string by parsing and rejoining it with POSIX separators,
 * keeping the root: `normalize('/a/./b')` is `'/a/b'` and `normalize('/')` is
 * `'/'`.
 *
 * @type {Unary<string, string>}
 */
export const normalize = path => {
    const p = toPosix(path)
    return rejoin(posixRoot(p))(p)
}

/**
 * Concatenates two path fragments and returns a normalized path.
 *
 * An absolute `b` names a path on its own, so it replaces `a` rather than being
 * appended to it. Otherwise the root comes from `a` and the segments from the
 * two joined — taking the root from `a` rather than from the joined string is
 * what stops the separator between them from being read as a root of its own,
 * so `concat('')('../x')` is `'../x'` and not `'x'`.
 *
 * @type {Reduce<string>}
 */
export const concat = a => b => {
    const pa = toPosix(a)
    const pb = toPosix(b)
    const rb = posixRoot(pb)
    const [r, p] = rb === '' ? [posixRoot(pa), stringConcat([pa, '/', pb])] : [rb, pb]
    return rejoin(r)(p)
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
