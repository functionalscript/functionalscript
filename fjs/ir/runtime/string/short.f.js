/**
 * Short-string pack / unpack helpers for the String runtime module
 * ([short-strings.md](../../../../doc/sasha-gil/ir/short-strings.md)).
 * Private to String: programs never import these; they prove bit
 * round-trips and feed later B/C templates. Encoding table:
 * [nan-box-patterns.md](../../../../doc/sasha-gil/ir/nan-box-patterns.md).
 *
 * @module
 *
 * @import { Result } from '../../../types/result/types.ts'
 * @import { ShortTag } from './types.ts'
 */

import { error, ok } from '../../../types/result/module.f.js'

/** Non-finite exponent bits shared by every scalar NaN box. */
const EXP = 0x7FF0_0000_0000_0000n

/** Tag-2 mask: non-finite scalars vs references. */
const TAG2 = 0x7FF0_0000_0000_0003n

/** Scalar family under TAG2 (low two bits clear, exponent all ones). */
const SCALAR = 0x7FF0_0000_0000_0000n

/** Empty-string box. */
export const EMPTY = 0x7FF0_0000_0000_0008n

/** `$`, `0`–`9`, `A`–`Z`, `_`, `a`–`z` — the 6-bit short-string alphabet. */
const ALPHABET = /** @type {const} */ ([
    0x24,
    0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39,
    0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x4b, 0x4c, 0x4d,
    0x4e, 0x4f, 0x50, 0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a,
    0x5f,
    0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x6b, 0x6c, 0x6d,
    0x6e, 0x6f, 0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a,
])

/** Every Sergey scalar string tag, for helpers and proofs. */
export const allTags = /** @type {const} */ ([
    'empty', 's1x16', 's2x16', 's3x16', 's4x7', 's5x7', 's6x7', 's7x7', 's8x6',
])

/**
 * v1 enabled set for NaN variants B/C (design open Q4 example): empty and
 * the two fixed-width UTF-16 tags; wider / narrow encodings stay force-long.
 */
export const v1EnabledTags = /** @type {const} */ (['empty', 's1x16', 's2x16'])

/** Whether bits are a short-string scalar (README `is_short_string`). @type {(b: bigint) => boolean} */
export const isShort = b => (b & TAG2) === SCALAR && (b & 0xCn) !== 0n

/**
 * Which short tag a short-string box uses, or `error` if the bits are not
 * a known short-string pattern.
 *
 * @type {(b: bigint) => Result<ShortTag, 'not_short'>}
 */
export const tagOf = b => {
    if (!isShort(b)) { return error('not_short') }
    // s7x7 first: its payload starts at bit 3, so low4 may be 0x4 or 0xC.
    if ((b & 0xFFF0_0000_0000_0007n) === 0xFFF0_0000_0000_0004n) { return ok('s7x7') }
    const low4 = b & 0xFn
    if (low4 === 0xCn) { return ok('s8x6') }
    if (low4 === 0x4n) { return ok('s3x16') }
    const low8 = b & 0xFFn
    if (low8 === 0x08n) { return ok('empty') }
    if (low8 === 0x18n) { return ok('s1x16') }
    if (low8 === 0x28n) { return ok('s2x16') }
    if (low8 === 0x48n) { return ok('s4x7') }
    if (low8 === 0x58n) { return ok('s5x7') }
    if (low8 === 0x68n) { return ok('s6x7') }
    return error('not_short')
}

/** @type {(c: number) => Result<number, 'wide'>} */
const toId6 = c => {
    if (c === 0x24) { return ok(0) }
    if (c < 0x30) { return error('wide') }
    if (c <= 0x39) { return ok(c - 0x2f) }
    if (c < 0x41) { return error('wide') }
    if (c <= 0x5a) { return ok(c - 0x36) }
    if (c === 0x5f) { return ok(37) }
    if (c < 0x61) { return error('wide') }
    if (c <= 0x7a) { return ok(c - 0x3b) }
    return error('wide')
}

/** @type {(units: readonly number[], n: number, w: number) => bigint} */
const packUnits = (units, n, w) => {
    /** @type {(i: number, acc: bigint) => bigint} */
    const go = (i, acc) => i === n ? acc
        : go(i + 1, acc | (BigInt(units[Number(i)]) << BigInt(i * w)))
    return go(0, 0n)
}

/** @type {(payload: bigint, n: number, w: number) => readonly number[]} */
const unpackUnits = (payload, n, w) => {
    const mask = (1n << BigInt(w)) - 1n
    /** @type {(i: number, acc: readonly number[]) => readonly number[]} */
    const go = (i, acc) => i === n ? acc
        : go(i + 1, [...acc, Number((payload >> BigInt(i * w)) & mask)])
    return go(0, [])
}

/** @type {(units: readonly number[]) => boolean} */
const fits7 = units => units.every(c => c <= 0x7f)

/** @type {(units: readonly number[]) => Result<readonly number[], 'wide'>} */
const codes6 = units => {
    /** @type {(i: number, acc: readonly number[]) => Result<readonly number[], 'wide'>} */
    const go = (i, acc) => {
        if (i === units.length) { return ok(acc) }
        const r = toId6(units[Number(i)])
        return r[0] === 'error' ? r : go(i + 1, [...acc, r[1]])
    }
    return go(0, [])
}

/**
 * Pack UTF-16 units into a short-string box when a Sergey tag fits.
 * Length alone is not enough: units must match an enabled tag's width
 * (design: packing eligibility is tag fit).
 *
 * @type {(units: readonly number[]) => Result<bigint, 'long'>}
 */
export const pack = units => {
    const n = units.length
    if (n === 0) { return ok(EMPTY) }
    if (n === 1) { return ok(EXP | (BigInt(units[Number(0)]) << 8n) | 0x18n) }
    if (n === 2) {
        return ok(EXP | (BigInt(units[Number(0)]) << 8n) | (BigInt(units[Number(1)]) << 24n) | 0x28n)
    }
    if (n === 3) {
        return ok(EXP | (packUnits(units, 3, 16) << 4n) | 0x4n)
    }
    if (n === 4) {
        return fits7(units) ? ok(EXP | (packUnits(units, 4, 7) << 8n) | 0x48n) : error('long')
    }
    if (n === 5) {
        return fits7(units) ? ok(EXP | (packUnits(units, 5, 7) << 8n) | 0x58n) : error('long')
    }
    if (n === 6) {
        return fits7(units) ? ok(EXP | (packUnits(units, 6, 7) << 8n) | 0x68n) : error('long')
    }
    if (n === 7) {
        return fits7(units)
            ? ok(0xFFF0_0000_0000_0004n | (packUnits(units, 7, 7) << 3n))
            : error('long')
    }
    if (n === 8) {
        const codes = codes6(units)
        return codes[0] === 'error'
            ? error('long')
            : ok(EXP | (packUnits(codes[1], 8, 6) << 4n) | 0xCn)
    }
    return error('long')
}

/**
 * Pack only when the natural tag is in `enabled`. A fit that uses a
 * disabled tag is forced long (not refused).
 *
 * @type {(units: readonly number[], enabled: readonly ShortTag[]) => Result<bigint, 'long'>}
 */
export const packEnabled = (units, enabled) => {
    const r = pack(units)
    if (r[0] === 'error') { return r }
    const t = tagOf(r[1])
    return t[0] === 'ok' && enabled.includes(t[1]) ? r : error('long')
}

/**
 * Unpack a short-string box to its UTF-16 units.
 *
 * @type {(b: bigint) => Result<readonly number[], 'not_short'>}
 */
export const unpack = b => {
    const t = tagOf(b)
    if (t[0] === 'error') { return t }
    const tag = t[1]
    if (tag === 'empty') { return ok([]) }
    if (tag === 's1x16') { return ok([Number((b >> 8n) & 0xffffn)]) }
    if (tag === 's2x16') {
        return ok([Number((b >> 8n) & 0xffffn), Number((b >> 24n) & 0xffffn)])
    }
    if (tag === 's3x16') { return ok(unpackUnits(b >> 4n, 3, 16)) }
    if (tag === 's4x7') { return ok(unpackUnits(b >> 8n, 4, 7)) }
    if (tag === 's5x7') { return ok(unpackUnits(b >> 8n, 5, 7)) }
    if (tag === 's6x7') { return ok(unpackUnits(b >> 8n, 6, 7)) }
    if (tag === 's7x7') { return ok(unpackUnits(b >> 3n, 7, 7)) }
    // s8x6: codes → alphabet units
    const codes = unpackUnits(b >> 4n, 8, 6)
    return ok(codes.map(c => ALPHABET[Number(c)]))
}

/** Length of a short-string box, or `error` if not short. @type {(b: bigint) => Result<number, 'not_short'>} */
export const length = b => {
    const u = unpack(b)
    return u[0] === 'error' ? u : ok(u[1].length)
}

/**
 * UTF-16 unit at index `i` of a short-string box. Out of range is `error`
 * (traps belong to the later linked `unit` / `at` path).
 *
 * @type {(b: bigint, i: number) => Result<number, 'not_short' | 'oob'>}
 */
export const unit = (b, i) => {
    const u = unpack(b)
    if (u[0] === 'error') { return u }
    return i < 0 || i >= u[1].length ? error('oob') : ok(u[1][Number(i)])
}
