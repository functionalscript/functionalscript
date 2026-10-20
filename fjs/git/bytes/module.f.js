/**
 * The readings Git's formats share: the fixed-width words and the prefix test
 * its binary formats are read with — a packfile's header, a pack index's
 * tables, a ref name's bytes — the cut a C string makes at its first NUL, and
 * the byte order names and refnames sort in.
 *
 * Every reader here takes an indexed array, not `Bytes`. A `Bytes` is a lazy
 * list — a cons, a concat, a thunk — so a reader normalises its input once,
 * with `byteArray`, and indexes the array from then on: a word read inside a
 * pack index's loops costs an index, not a second materialisation of the file.
 *
 * @module
 *
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Sign } from '../../types/function/compare/types.ts'
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
export const u32be = (b, at) => b[Number(at)] * 0x100_0000 + b[Number(at + 1)] * 0x1_0000 + b[Number(at + 2)] * 0x100 + b[Number(at + 3)]

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
    const v = u32be(b, at) * 0x1_0000_0000 + u32be(b, at + 4)
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

/**
 * The bytes before the first NUL, or all of them where there is none.
 *
 * Git hands several values on as C strings — a tag's `type`, a
 * `packed-refs` header, a `gitdir:` path — and a C string ends at its first
 * NUL, so the bytes after one are no part of the value however many there
 * are. {@link untilNul} is the same cut for a value already read as text.
 *
 * @type {(b: readonly number[]) => readonly number[]}
 */
export const cString = b => {
    const end = b.indexOf(0x00)
    return end === -1 ? b : b.slice(0, end)
}

/**
 * The characters before the first NUL, or all of them: {@link cString} for a
 * value a reader holds as a string, such as a config value or an alternates
 * path.
 *
 * @type {(s: string) => string}
 */
export const untilNul = s => {
    const end = s.indexOf('\u0000')
    return end === -1 ? s : s.slice(0, end)
}

/**
 * The order of `a` and `b` byte by byte, unsigned: the first differing byte
 * decides, and a proper prefix sorts first. It is the order Git sorts a
 * tree's names and writes `packed-refs` in, and the one its bisection of
 * that file assumes.
 *
 * This is not `fjs/rtti/data`'s `cmpList`, which is short-lex: a shorter
 * list sorts first there whatever its bytes.
 *
 * @type {(a: readonly number[], b: readonly number[]) => Sign}
 */
export const cmp = (a, b) => {
    const i = a.findIndex((x, k) => k >= b.length || x !== b[Number(k)])
    return i === -1 ? (a.length < b.length ? -1 : 0)
        : i >= b.length || a[Number(i)] > b[Number(i)] ? 1 : -1
}
