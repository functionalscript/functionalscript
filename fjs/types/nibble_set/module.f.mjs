/**
 * Nibble-set operations for compact 4-bit membership tracking.
 *
 * A set of nibbles (values `0..15`) stored as a 16-bit mask in a plain
 * `number`. It implements the same bitmask-as-set algebra as
 * {@link ../byte_set/module.f.mjs | `byte_set`}, which tracks all 256 byte
 * values in a `bigint`.
 *
 * **Prefer `byte_set`.** Its 256-value universe covers the common cases and
 * it is the set type used across the codebase. Use `nibble_set` only when
 * the set has to be serialized into JSON: a `NibbleSet` is a `number`, which
 * round-trips through `JSON.stringify`/`JSON.parse` as-is, while a
 * `ByteSet` is a `bigint`, which `JSON.stringify` cannot serialize.
 *
 * @module
 */

/** @import { Nibble, NibbleSet } from './types.ts' */

export const empty = 0

export const universe = 0xFFFF

/** @type {(n: Nibble) => NibbleSet} */
const one = n => 1 << n

/** @type {(n: Nibble) => (s: NibbleSet) => boolean} */
export const has = n => s => ((s >> n) & 1) === 1

/** @type {(n: Nibble) => (s: NibbleSet) => NibbleSet} */
export const set = n => s => s | one(n)

/** @type {(n: NibbleSet) => NibbleSet} */
export const complement = s => universe ^ s

/** @type {(n: Nibble) => (s: NibbleSet) => NibbleSet} */
export const unset = n => s => s & complement(one(n))

/** @type {(r: readonly [number, number]) => NibbleSet} */
const range = ([a, b]) => one(b - a + 1) - 1 << a

/** @type {(r: readonly [number, number]) => (s: NibbleSet) => NibbleSet} */
export const setRange = r => s => s | range(r)
