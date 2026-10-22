/**
 * Implementation-private types of the branch backend: what its tree
 * surgery answers, and one keyed entry of the map.
 *
 * @module
 */

import type { Vec } from '../../types/bit_vec/types.ts'
import type { Oid } from '../../git/types.ts'

/**
 * What taking a path out of a tree answers: `same` where the tree held no
 * such path and stands; `gone` where the tree is empty without it, so the
 * entry naming it goes too; and the id of the tree rebuilt without it.
 */
export type _Removal = readonly ['same'] | readonly ['gone'] | readonly ['tree', Oid]

/** One entry of the CAS map: a key and the blob it names. */
export type _Keyed = {
    readonly key: Vec
    readonly oid: Oid
}

/**
 * One change a proposal makes to the map, relative to the base it was built
 * on: a key added with its blob, or a key taken out.
 */
export type _Change = readonly ['add', _Keyed] | readonly ['delete', Vec]
