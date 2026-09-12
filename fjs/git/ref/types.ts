/**
 * Types for the three files a repository keeps its refs in.
 *
 * @module
 */

import type { Nullable } from '../../types/nullable/types.ts'
import type { Bytes, Oid } from '../types.ts'

/**
 * What one ref file holds: an id, or the name of another ref.
 *
 * `HEAD` is either, and the two are not interchangeable. A direct ref names
 * an object and a symbolic one names a ref that may not exist yet, which is
 * what `git init` leaves behind before the first commit. A reader that
 * flattened them would have to invent an id for the second.
 */
export type Ref =
    | { readonly kind: 'direct', readonly id: Oid }
    | { readonly kind: 'symbolic', readonly target: Bytes }

/**
 * One line of `packed-refs`: the id, the name it is packed under, and the
 * id the `^` line below it gave, where there was one.
 *
 * `peeled` is a shortcut and never the rule. A packed tag may carry it and a
 * loose tag ref cannot, so a consumer that needs what a tag points at peels
 * through the object store either way and uses this only to skip a read.
 */
export type PackedRef = {
    readonly name: Bytes
    readonly id: Oid
    readonly peeled: Nullable<Oid>
}
