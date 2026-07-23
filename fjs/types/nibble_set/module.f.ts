/**
 * Nibble-set operations for compact 4-bit membership tracking.
 *
 * A set of nibbles (values `0..15`) stored as a 16-bit mask in a plain
 * `number`. It implements the same bitmask-as-set algebra as
 * {@link ../byte_set/module.f.ts | `byte_set`}, which tracks all 256 byte
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

/** A set of nibbles as a 16-bit mask. JSON-serializable. */
export type NibbleSet = number

/** A 4-bit value, `0..15`. */
export type Nibble = number

export const empty = 0

export const universe = 0xFFFF

const one: (n: Nibble) => NibbleSet
    = n => 1 << n

export const has: (n: Nibble) => (s: NibbleSet) => boolean
    = n => s => ((s >> n) & 1) === 1

export const set: (n: Nibble) => (s: NibbleSet) => NibbleSet
    = n => s => s | one(n)

export const complement: (n: NibbleSet) => NibbleSet
    = s => universe ^ s

export const unset: (n: Nibble) => (s: NibbleSet) => NibbleSet
    = n => s => s & complement(one(n))

const range: (r: readonly [number, number]) => NibbleSet
    = ([a, b]) => one(b - a + 1) - 1 << a

export const setRange: (r: readonly [number, number]) => (s: NibbleSet) => NibbleSet
    = r => s => s | range(r)
