/**
 * The fixed-width words and the prefix test Git's binary formats are read
 * with: a packfile's header, a pack index's tables, and a ref name's bytes.
 *
 * Every reader here takes an indexed array, not `Bytes`. A `Bytes` is a lazy
 * list — a cons, a concat, a thunk — so a reader normalises its input once,
 * with `byteArray`, and indexes the array from then on: a word read inside a
 * pack index's loops costs an index, not a second materialisation of the file.
 *
 * @module
 *
 * @import { Nullable } from '../../types/nullable/types.ts'
 */

/**
 * The unsigned big-endian 32-bit word at `at`, read as arithmetic rather than
 * with shifts.
 *
 * `<<` in JavaScript is a 32-bit *signed* operation, so `b[at] << 24` is
 * negative for a first byte of 0x80 or more and needs an unsigned coercion
 * to undo. Multiplying never has that shape.
 *
 * @type {(b: readonly number[], at: number) => number}
 */
export const u32be = (b, at) => b[Number(at)] * 16777216 + b[Number(at + 1)] * 65536 + b[Number(at + 2)] * 256 + b[Number(at + 3)]

/**
 * The big-endian 64-bit word at `at`, or `null` where it is above the range a
 * `number` holds exactly.
 *
 * A `number` holds an integer exactly up to 2^53 - 1, and a word this module
 * reads is a byte offset or a count, which goes on to `readBytes` or an array
 * length. So a value above that is refused rather than rounded: 2^53 bytes is
 * 8 PiB, which no Git file is, and a value that big is a corrupt file rather
 * than a large one.
 *
 * @type {(b: readonly number[], at: number) => Nullable<number>}
 */
export const u64be = (b, at) => {
    const v = u32be(b, at) * 4294967296 + u32be(b, at + 4)
    return Number.isSafeInteger(v) ? v : null
}

/**
 * Whether `b` begins with `prefix`: a magic number, a signature, a name.
 *
 * A `b` shorter than `prefix` does not, since the bytes past its end are
 * `undefined` and equal to none of `prefix`'s.
 *
 * @type {(prefix: readonly number[]) => (b: readonly number[]) => boolean}
 */
export const startsWith = prefix => b => prefix.every((v, i) => b[Number(i)] === v)
