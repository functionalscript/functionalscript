/**
 * Types for the walk: what it reads objects through, and what it answers.
 *
 * @module
 */

import type { Effect, IoChannel, Operation } from '../../effects/types.ts'
import type { Nullable } from '../../types/nullable/types.ts'
import type { Envelope } from '../object/types.ts'
import type { TreeEntry } from '../tree/types.ts'
import type { Bytes, ObjectType, Oid } from '../types.ts'

/**
 * How the walk reads an object: from an id to the object it names, or
 * `null` where the bytes stored are no object, with a missing object and a
 * file that hashes to another id in the channel. `tryRead(dir, oidBytes)`
 * in [`fjs/git/store`](../store/module.f.mjs) is one, and the walk takes
 * it as a parameter rather than a directory, so what the walk does is
 * separable from where the objects live.
 */
export type Read<O extends Operation> = (id: Oid) => Effect<O, Nullable<Envelope>, IoChannel>

/**
 * A step of the walk: from an id to what the step found, or `null` where
 * the objects read cannot take it there.
 */
export type Step<O extends Operation, T> = (id: Oid) => Effect<O, Nullable<T>, IoChannel>

/**
 * The last step: from an id and a path, its components in order, to the
 * entry the path names. A component is a name's bytes, since a name is
 * bytes and no name holds the `/` a caller splits a path on.
 */
export type Entry<O extends Operation> = (id: Oid, path: readonly Bytes[]) => Effect<O, Nullable<TreeEntry>, IoChannel>

/** An object the walk reached, and the id it was reached by. */
export type Target = {
    readonly id: Oid
    readonly envelope: Envelope
}

/**
 * One id the peel has still to read, and the type the tag that named it
 * declared for it — `null` at the chain's head, where nothing declared
 * one.
 */
export type PeelItem = {
    readonly id: Oid
    readonly want: Nullable<ObjectType>
}

/**
 * What the peel carries along the chain: `seen` the ids it has read, so an
 * id it comes back to is refused as the cycle it is, and `target` the
 * object it stopped at, `null` until it stops at one and where it stops at
 * none.
 */
export type PeelState = {
    readonly seen: readonly Oid[]
    readonly target: Nullable<Target>
}

/**
 * One component of a path and whether it is the last, which is what
 * decides whether the entry it names is read as a tree or answered.
 */
export type PathItem = {
    readonly name: readonly number[]
    readonly last: boolean
}

/**
 * What the path walk carries from one component to the next: `entries` the
 * tree the next component is looked up in, `null` where the path has
 * already run out of tree, and `found` the entry the last component
 * matched.
 */
export type PathState = {
    readonly entries: Nullable<readonly TreeEntry[]>
    readonly found: Nullable<TreeEntry>
}
