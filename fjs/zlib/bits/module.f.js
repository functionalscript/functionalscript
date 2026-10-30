/**
 * Bits of a DEFLATE stream (RFC 1951 section 3.1.1): a stream is bytes, and
 * each byte is read from its least significant bit, so a number of `n` bits is
 * the little-endian number the next `n` bits make, the first bit the lowest.
 *
 * A position is a bit offset into an array of bytes. Reading does not move
 * it: what is read and where it ended are the reader's to keep, so a read that
 * the input is too short for leaves nothing to undo.
 *
 * @module
 */

import { assert } from '../../asserts/module.f.js'

/** What a read answers where the input ends before the bits do. */
export const more = 'more'

/**
 * The `n` bits at bit `pos` of `input`, `n` at most 16, or {@link more} while
 * the input is shorter.
 *
 * @type {(input: readonly number[], pos: number, n: number) => number | typeof more}
 */
export const read = (input, pos, n) => {
    assert(n <= 16, 'at most sixteen bits')
    if (n === 0) { return 0 }
    const first = pos >> 3
    const shift = pos & 7
    // at most three bytes: seven bits of the first and sixteen more
    const count = shift + n + 7 >> 3
    if (first + count > input.length) { return more }
    let word = 0
    for (let i = 0; i < count; i += 1) { word |= input[Number(first + i)] << 8 * i }
    return word >> shift & (1 << n) - 1
}
