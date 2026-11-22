/**
 * What the [records pass](./module.f.js) reads and writes as it goes.
 *
 * @module
 */

import type { Term } from '../types.ts'

/**
 * Where a value comes from: an object that a function builds, by the path
 * of its term and its keys; a local, by the path that binds it; or anything
 * else.
 */
export type _Source =
    | readonly ['site', id: string, keys: readonly string[]]
    | readonly ['bind', id: string]
    | readonly ['opaque']

/**
 * What the pass learns of a function, one fact at a time:
 *
 * - `local`: a local, by its path, and whether a `let` or a loop binds it,
 *   which the pass may split, or something else, a parameter or the name of
 *   an arm, which it may not;
 * - `site`: an object that the function builds, its keys, and whether each
 *   of its values does nothing, so that a read of one key may skip the
 *   others;
 * - `def`: a value that a local takes, from where;
 * - `read`: a read of a key, by L1's `get`, of a value that comes from any
 *   of `from`;
 * - `escape`: a value used some other way, which must stay an object;
 * - `bad`: a local that the pass may not split, since what it would move
 *   would cross something that does something.
 */
export type _Fact =
    | readonly ['local', id: string, kind: 'split' | 'other']
    | readonly ['site', id: string, keys: readonly string[], pure: boolean]
    | readonly ['def', target: string, from: _Source]
    | readonly ['read', id: string, key: string, from: readonly _Source[]]
    | readonly ['escape', from: _Source]
    | readonly ['bad', id: string]

/** A local in scope: its name, the path that binds it, and the name that the pass writes for it. */
export type _Local = readonly [name: string, id: string, written: string]

/** A label in scope: a loop, with its parameters, each a local, or any other region. */
export type _Label = readonly [label: string, params: readonly _Local[] | null]

/** What a function's scope holds where a term stands: its locals, latest first, and its labels. */
export type _Env = {
    readonly locals: readonly _Local[]
    readonly labels: readonly _Label[]
}

/** The objects and the locals that the pass splits: each local with its keys, and the paths of the objects. */
export type _Split = {
    readonly locals: readonly (readonly [id: string, keys: readonly string[]])[]
    readonly sites: readonly string[]
    readonly reads: readonly string[]
}

/** An object that a function builds: its keys and its values, in their order. */
export type _Site = readonly (readonly [key: string, value: Term])[]
