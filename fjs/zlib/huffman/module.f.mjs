/**
 * The Huffman codes of DEFLATE (RFC 1951 section 3.2), read as zlib reads
 * them: which sets of lengths make a code, how a symbol is decoded from the
 * bits, the two codes a fixed block has, and the table description a dynamic
 * block opens with. Where zlib takes a stream, this takes it, and where it
 * refuses one, so does this — down to the one incomplete code it allows, and
 * the code-lengths code it reads a zero from when it has no symbol at all —
 * since a decoder that differs there takes streams another refuses.
 *
 * @module
 *
 * @import { Nullable } from '../../types/nullable/types.ts'
 * @import { Code, Codes } from './types.ts'
 */

import { more, read } from '../bits/module.f.js'

/**
 * The code a list of lengths names, or `null` where zlib refuses it: more
 * codes of a length than that length has, or fewer than all of them. The one
 * incomplete code zlib takes is a single code of one bit, which is how a stream
 * spells a lone distance, or none at all; `complete` refuses an incomplete code
 * even so, as the code-lengths code is.
 *
 * @type {(lengths: readonly number[], complete: boolean) => Nullable<Code>}
 */
export const code = (lengths, complete) => {
    const count = Array.from({ length: 16 }, (_, length) => lengths.filter(x => x === length).length)
    // the codes of each length left after those of the shorter ones, doubled:
    // negative where a length has more than it has room for
    const left = count.slice(1).reduce((room, n) => room < 0 ? room : room * 2 - n, 1)
    const used = lengths.length - count[0]
    const longest = count.reduce((most, n, length) => n !== 0 ? length : most, 0)
    if (left < 0 || left > 0 && used !== 0 && (complete || longest !== 1)) { return null }
    return {
        count,
        // the symbols by length, and by value within a length
        symbol: Array.from({ length: 15 }, (_, i) => lengths.flatMap((x, s) => x === i + 1 ? [s] : [])).flat(),
        incomplete: left > 0,
    }
}

/**
 * The symbol at bit `pos` of `input` and how many bits it took, {@link more}
 * while the input is shorter, or `null` where the bits are no code of this one.
 *
 * @type {(c: Code, input: readonly number[], pos: number) => readonly [number, number] | typeof more | null}
 */
export const decode = ({ count, symbol, incomplete }, input, pos) => {
    let bits = 0
    let first = 0
    let index = 0
    for (let length = 1; length < 16; length += 1) {
        const at = pos + length - 1
        const byte = input[at >> 3]
        if (byte === undefined) { return more }
        bits |= byte >> (at & 7) & 1
        const n = count[length]
        if (bits - n < first) { return [symbol[index + bits - first], length] }
        index += n
        first = first + n << 1
        bits <<= 1
        // zlib refuses an incomplete code after one bit, not after all fifteen
        if (incomplete) { break }
    }
    return null
}

/** The fixed literal/length code: 8, 9, 7 and 8 bits over 288 symbols. */
export const fixedLiterals = /** @type {Code} */ (code(
    [...Array(144).fill(8), ...Array(112).fill(9), ...Array(24).fill(7), ...Array(8).fill(8)],
    true,
))

/** The fixed distance code: five bits for each of 32 symbols, the last two of which name no distance. */
export const fixedDistances = /** @type {Code} */ (code(Array(32).fill(5), true))

/** The two codes of a fixed block. */
export const fixed = /** @type {Codes} */ ({ literals: fixedLiterals, distances: fixedDistances })

/** The order the lengths of the code-lengths code come in, RFC 1951 section 3.2.7. */
const lengthsOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]

/** The extra bits of the repeat symbols 16, 17 and 18, and what they add to. */
const repeats = /** @type {const} */ ([[2, 3], [3, 3], [7, 11]])

/**
 * Reads a length: a symbol of the code-lengths code, below 16 a length itself,
 * and above it a repeat of the one before it, for 16, or of zero. The lengths
 * it gives, and where it ended.
 *
 * @type {(lengthsCode: Code, lengths: readonly number[], input: readonly number[], pos: number) => readonly [readonly number[], number] | typeof more | null}
 */
const nextLengths = (lengthsCode, lengths, input, pos) => {
    // zlib reads a zero for each bit of a code-lengths code that has no
    // symbol, and fails later for the end-of-block it lacks
    const symbol = lengthsCode.symbol.length === 0
        ? read(input, pos, 1) === more ? more : [0, 1]
        : decode(lengthsCode, input, pos)
    if (symbol === more || symbol === null) { return symbol }
    const [value, taken] = symbol
    if (value < 16) { return [[value], pos + taken] }
    const [width, base] = repeats[value - 16]
    const extra = read(input, pos + taken, width)
    if (extra === more) { return more }
    // 16 repeats the last length, and there is none before the first
    return value === 16 && lengths.length === 0
        ? null
        : [Array(base + extra).fill(value === 16 ? lengths[lengths.length - 1] : 0), pos + taken + width]
}

/**
 * The two codes a dynamic block states, from bit `pos` of `input` — its three
 * counts, the lengths of the code-lengths code, and the lengths of both codes
 * run together under it — and where they end; {@link more} while the input is
 * shorter, or `null` for a description zlib refuses: too many symbols, a code
 * that is not a code, a repeat that runs past the end, or no end-of-block.
 *
 * @type {(input: readonly number[], pos: number) => readonly [Codes, number] | typeof more | null}
 */
export const dynamic = (input, pos) => {
    const counts = read(input, pos, 14)
    if (counts === more) { return more }
    const literals = (counts & 31) + 257
    const distances = (counts >> 5 & 31) + 1
    const lengthsCount = (counts >> 10) + 4
    if (literals > 286 || distances > 30) { return null }
    let at = pos + 14
    /** @type {readonly number[]} */
    let order = Array(19).fill(0)
    for (let i = 0; i < lengthsCount; i += 1) {
        const length = read(input, at, 3)
        if (length === more) { return more }
        order = order.map((x, slot) => slot === lengthsOrder[i] ? length : x)
        at += 3
    }
    const lengthsCode = code(order, true)
    if (lengthsCode === null) { return null }
    /** @type {readonly number[]} */
    let lengths = []
    while (lengths.length < literals + distances) {
        const next = nextLengths(lengthsCode, lengths, input, at)
        if (next === more || next === null) { return next }
        lengths = [...lengths, ...next[0]]
        at = next[1]
    }
    if (lengths.length > literals + distances || lengths[256] === 0) { return null }
    const literalsCode = code(lengths.slice(0, literals), false)
    const distancesCode = code(lengths.slice(literals), false)
    return literalsCode === null || distancesCode === null
        ? null
        : [{ literals: literalsCode, distances: distancesCode }, at]
}
