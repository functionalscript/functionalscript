/**
 * Path parsing and normalization helpers for portable module paths.
 *
 * A path is a {@link root} followed by segments. The root is what makes the
 * path absolute — `/`, `//` for a UNC path, or `C:/` for a Windows drive —
 * and it is not a segment: it survives normalization, and `..` cannot escape
 * it. Everything after it folds by the usual rules, so `a//b` is `a/b` and
 * `a/../b` is `b`.
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

/** @type {(c: string) => boolean} */
const isDriveLetter = c => (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')

/**
 * A Windows drive root, and only in its absolute spelling: `C:/` roots the
 * path, while a bare `C:` and the drive-relative `C:foo` — which names the
 * current directory *on* drive C — do not, and stay ordinary segments.
 *
 * @type {(p: string) => boolean}
 */
const isDriveRoot = p => p.length >= 3 && p[1] === ':' && p[2] === '/' && isDriveLetter(p[0])

/**
 * A bare drive, which {@link isDriveRoot} deliberately excludes — and which
 * {@link concat} must therefore not turn into one. The separator `concat`
 * inserts between its two arguments is what would do it: `C:` and `dir` joined
 * with a `/` is the drive root `C:/dir` rather than the drive-relative `C:dir`,
 * a different place on the disk. Joined without one, the answer stays the kind
 * of path it started as.
 *
 * This keeps `concat` from changing a path's kind. It does not make the
 * drive-relative form *resolve* like Windows: `C:dir` is one ordinary segment
 * here, so `concat('C:dir')('../..')` is `'..'` where Windows says `C:..`.
 * Modelling that needs a third kind of path, which this module does not have.
 *
 * @type {(p: string) => boolean}
 */
const isBareDrive = p => p.length === 2 && p[1] === ':' && isDriveLetter(p[0])

/**
 * Splits an already-POSIX path into its root and everything after it, so that
 * `root + rest` is the path again. The root carries its own trailing separator
 * — `'/'`, `'//'`, `'C:/'`, or `''` — which is what lets {@link rejoin} put a
 * path back together without a separator of its own.
 *
 * A root is a fixed-width prefix here, never a parsed one. `//` marks a UNC
 * path but stops there rather than swallowing `server/share`: those are two
 * arbitrary segments, and a path like `//a/../../etc/passwd` would fold `../`
 * *into* the root, which is precisely what a root must not do. Three or more
 * leading slashes are an ordinary root followed by empty segments, which is
 * what POSIX requires.
 *
 * @type {(p: string) => readonly [root: string, rest: string]}
 */
const split = p =>
    p.startsWith('//') && !p.startsWith('///') ? ['//', p.slice(2)]
    : p.startsWith('/') ? ['/', p.slice(1)]
    : isDriveRoot(p) ? [p.slice(0, 3), p.slice(3)]
    : ['', p]

/** @type {(rooted: boolean) => (rest: string) => readonly string[]} */
const posixSegments = rooted => rest => toArray(fold(foldNormalizeOp(rooted))([])(rest.split('/')))

/** @type {(s: readonly [string, string]) => string} */
const rejoin = ([r, rest]) => stringConcat([r, listJoin('/')(posixSegments(r !== '')(rest))])

/**
 * The root of a path, carrying its trailing separator: `'/'` for a POSIX
 * absolute path, `'//'` for a UNC one, `'C:/'` for a Windows drive, and `''`
 * for a relative path.
 *
 * `..` cannot escape whatever this answers, so it is also the definition of
 * how far up a path can go. On Windows that is not quite the whole story: the
 * `server/share` of a UNC path is part of its root there and is an ordinary
 * segment here, so `..` can still climb past a share — see
 * {@link split} for why the root stops at `//`.
 *
 * A drive root is the one that folding can *create*. `/` and `//` are prefixes
 * of the text, so no amount of `.`/`..` collapsing produces one; `C:/` is a
 * segment's content, so a relative path whose first segment happens to be a
 * drive letter becomes drive-rooted once folded — `root('./C:/a')` is `''`
 * while `root(normalize('./C:/a'))` is `'C:/'`. On Windows that is the reading
 * that is wanted; on a POSIX host with a directory actually named `C:` it is
 * not, and this module has no way to tell the two apart after folding.
 *
 * @type {(path: string) => string}
 */
export const root = path => split(toPosix(path))[0]

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
    const [r, rest] = split(toPosix(path))
    return posixSegments(r !== '')(rest)
}

/**
 * Normalizes a path string by parsing and rejoining it with POSIX separators,
 * keeping the root: `normalize('/a/./b')` is `'/a/b'` and `normalize('/')` is
 * `'/'`.
 *
 * @type {Unary<string, string>}
 */
export const normalize = path => rejoin(split(toPosix(path)))

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
    const [rb, restb] = split(toPosix(b))
    if (rb !== '') { return rejoin([rb, restb]) }
    // `a` is normalized before its root is read, because what `a` *is* decides
    // the join and only the folded form answers that: `./C:` and `x/../C:` are
    // both the bare drive `C:`, and reading them unfolded would insert the
    // separator that makes a drive root out of one.
    const [ra, resta] = split(normalize(a))
    return rejoin([ra, stringConcat([resta, isBareDrive(resta) ? '' : '/', restb])])
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
