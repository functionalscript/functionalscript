/**
 * Implementation-private types for the walk of `refs/` in `./module.f.mjs`.
 *
 * @module
 */

import type { Nullable } from '../../types/nullable/types.ts'
import type { Root } from './types.ts'

/**
 * One entry of the walk of `refs/`: where the file is, the ref name it would
 * be, and whether to descend into it.
 *
 * The name is carried down beside the path rather than recovered from it
 * afterwards. A path and a ref name are spelled differently — the path is the
 * host's and may hold either separator, the name is always `/` — so deriving
 * one from the other means undoing a join, and carrying both costs a field.
 */
export type _Entry = {
    readonly path: string
    readonly name: string
    readonly isDirectory: boolean
}

/**
 * What the walk of `refs/` has found so far: the roots, and every ref name it
 * has seen a loose file for.
 *
 * The names are kept apart from the roots because shadowing is by the file
 * existing and not by it yielding a root. A loose symbolic ref whose target is
 * nowhere gives no root, and it must still hide the packed line of the same
 * name — otherwise a name whose loose file replaced a packed one comes back
 * with the stale packed id, which is the opposite of what the loose file says.
 */
export type _Found = {
    readonly roots: readonly Root[]
    readonly names: readonly (readonly number[])[]
}

/**
 * What one step of the walk answers: what has been found so far, and the
 * entries to walk next.
 *
 * Named because the branches build it from different shapes — a directory adds
 * entries and no roots, a ref adds a root and no entries — and without one name
 * for the pair each branch infers its own literal type and none of them unify.
 */
export type _Walked = readonly [Nullable<_Found>, Nullable<readonly _Entry[]>]
