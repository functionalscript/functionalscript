/**
 * Nibble-set operations for compact 4-bit membership tracking.
 *
 * A set of nibbles (values `0..15`) stored as a 16-bit mask in a plain
 * `number`. It is the {@link ../bit_set/module.f.mjs | `bit_set`} algebra
 * over `number`, as {@link ../byte_set/module.f.mjs | `byte_set`} is the same
 * algebra over a `bigint` tracking all 256 byte values.
 *
 * **Prefer `byte_set`.** Its 256-value universe covers the common cases and
 * it is the set type used across the codebase. Use `nibble_set` only when
 * the set has to be serialized into JSON: a `NibbleSet` is a `number`, which
 * round-trips through `JSON.stringify`/`JSON.parse` as-is, while a
 * `ByteSet` is a `bigint`, which `JSON.stringify` cannot serialize.
 *
 * @module
 *
 * @import { Nibble, NibbleSet } from './types.ts'
 */

import { bitSet, numberOps } from '../bit_set/module.f.mjs'

const nibbleSet = bitSet(numberOps)(16)

export const empty = nibbleSet.empty

export const universe = nibbleSet.universe

/** @type {(n: Nibble) => (s: NibbleSet) => boolean} */
export const has = nibbleSet.has

/** @type {(n: Nibble) => (s: NibbleSet) => NibbleSet} */
export const set = nibbleSet.set

/** @type {(n: NibbleSet) => NibbleSet} */
export const complement = nibbleSet.complement

/** @type {(n: Nibble) => (s: NibbleSet) => NibbleSet} */
export const unset = nibbleSet.unset

/** @type {(r: readonly [number, number]) => (s: NibbleSet) => NibbleSet} */
export const setRange = nibbleSet.setRange
