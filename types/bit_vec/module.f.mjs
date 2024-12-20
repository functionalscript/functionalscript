// @ts-self-types="./module.f.d.mts"
import { log2 } from '../bigint/module.f.mjs'
import { flip } from '../function/module.f.mjs'

/**
 * A vector of bits represented as a `bigint`.
 *
 * @typedef {bigint} Vec
 */

/**
 * An empty vector of bits.
 */
export const empty = 1n

/**
 * Calculates the length of the given vector of bits.
 */
export const lenght = log2

/**
 * Creates a vector of bits of the given `len` and the given unsigned integer.
 *
 * @type {(len: bigint) => (ui: bigint) => Vec}
 *
 * @example
 *
 * ```js
 * const vec4 = vec(4n)
 * const v0 = vec4(5n)     // 0x15n
 * const v1 = vec4(0x5FEn) // 0x1En
 * ```
 */
export const vec = len => {
    if (len <= 0n) { return () => empty }
    const stop = 1n << len
    const mask = stop - 1n
    return data => stop | (data & mask)
}

/** @type {(len: bigint) => bigint} */
const mask = len => (1n << len) - 1n

/**
 * Returns the unsigned integer of the given vector by removing a stop bit.
 *
 * @type {(len: Vec) => bigint}
 */
export const uint = v => v ^ (1n << lenght(v))

/**
 * Extract the least significant unsigned integer from the given vector.
 *
 * @type {(uintLen: bigint) => (v: Vec) => bigint}
 *
 * @example
 *
 * ```js
 * const vector = vec(8n)(0xF5n) // 0x1F5n
 * const result = uintLsb(4n)(vector); // result is 5n
 * const result2 = uintLsb(16n)(vector); // result2 is 0xF5n
 * ```
 */
export const uintLsb = len => {
    const m = mask(len)
    return v => {
        const result = v & m
        return result === v ? uint(v) : result
    }
}

/**
 * Removes the first `len` least significant bits from the given vector.
 *
 * @type {(len: bigint) => (v: Vec) => Vec}
 *
 * @example
 *
 * ```js
 * const v = vec(16n)(0x3456n) // 0x13456n
 * const r = removeLsb(4n)(v) // 0x1345n
 * const r2 = removeLsb(24n)(v) // 0x1n
 * ```
 */
export const removeLsb = len => v => {
    const r = v >> len
    return r === 0n ? empty : r
}

/**
 * @type {(len: bigint) => (v: Vec) => [bigint, Vec]}
 */
export const popUintLsb = len => {
    const m = mask(len)
    return v => {
        const result = v & m
        return result === v ? [uint(v), empty] : [result, v >> len]
    }
}

/**
 * Extract the most significant unsigned integer of the given `len` from the given vector.
 *
 * @type {(len: bigint) => (v: Vec) => bigint}
 *
 * @example
 *
 * ```js
 * const vector = vec(8n)(0xF5n) // 0x1F5n
 * const result = uintMsb(4n)(vector); // result is 0xFn
 * const result2 = uintMsb(16n)(vector); // result2 is 0xF500n
 * ```
 */
export const uintMsb = len => {
    const m = mask(len)
    return v => (v >> (lenght(v) - len)) & m
}

/**
 * Removes the first `len` most significant bits from the given vector.
 *
 * @type {(len: bigint) => (v: Vec) => Vec}
 *
 * @example
 *
 * ```js
 * const v = vec(16n)(0x3456n) // 0x13456n
 * const r = removeMsb(4n)(v) // 0x1456n
 * const r2 = removeMsb(24n)(v) // 0x1n
 * ```
 */
export const removeMsb = len => v => vec(lenght(v) - len)(v)

/** @type {(len: bigint) => (v: Vec) => [bigint, Vec]} */
export const popUintMsb = len => {
    const m = mask(len)
    return v => {
        const d = lenght(v) - len
        return [(v >> d) & m, vec(d)(v)]
    }
}

/**
 * Concat the given vectors of bits. The first vector is the least significant.
 *
 * @type {(a: Vec) => (b: Vec) => Vec}
 *
 * @example
 *
 * ```js
 * const u8 = vec(8n)
 * const a = u8(0x45n) // 0x145n
 * const b = u8(0x89n) // 0x189n
 * const ab = concatLsb(a)(b) // 0x18945n
 * ```
 */
export const concatLsb = a => {
    const aLen = lenght(a)
    const m = mask(aLen)
    return b => (b << aLen) | (a & m)
}

/**
 * Concat the given vectors of bits. The first vector is the most significant.
 *
 * @type {(b: Vec) => (a: Vec) => Vec}
 *
 * @example
 *
 * ```js
 * const u8 = vec(8n)
 * const a = u8(0x45n) // 0x145n
 * const b = u8(0x89n) // 0x189n
 * const ab = concatMsb(a)(b) // 0x14589n
 * ```
 */
export const concatMsb = flip(concatLsb)
