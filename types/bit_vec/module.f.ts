import { log2, mask } from '../bigint/module.f.ts'
import { flip } from '../function/module.f.ts'

/**
 * A vector of bits represented as a `bigint`.
 */
export type Vec = bigint

/**
 * An empty vector of bits.
 */
export const empty = 1n

/**
 * Calculates the length of the given vector of bits.
 */
export const length = log2

/**
 * Creates a vector of bits of the given `len` and the given unsigned integer.
 *
 * @example
 *
 * ```js
 * const vec4 = vec(4n)
 * const v0 = vec4(5n)     // 0x15n
 * const v1 = vec4(0x5FEn) // 0x1En
 * ```
 */
export const vec = (len: bigint): (ui: bigint) => Vec => {
    if (len <= 0n) { return () => empty }
    const stop = 1n << len
    const mask = stop - 1n
    return data => stop | (data & mask)
}

/**
 * Returns the unsigned integer of the given vector by removing a stop bit.
 *
 * @example
 *
 * ```js
 * const vector = vec(8n)(0x5n) // 0x105n
 * const result = uint(vector); // result is 0x5n
 * ```
 */
export const uint = (v: Vec): bigint => v ^ (1n << length(v))

/**
 * Represents operations for handling bit vectors with a specific endian order.
 */
export type Endian = {
    /**
     * Retrieves the first unsigned integer of the specified length from the given vector.
     *
     * @param len - The number of bits to read from the start of the vector.
     * @returns A function that takes a vector and returns the extracted unsigned integer.
     *
     * @example
     *
     * ```js
     * const vector = vec(8n)(0xF5n) // 0x1F5n
     *
     * const resultL0 = lsbFirst.front(4n)(vector)  // resultL0 is 5n
     * const resultL1 = lsbFirst.front(16n)(vector) // resultL1 is 0xF5n
     *
     * const resultM0 = msbFirst.front(4n)(vector)  // resultM0 is 0xFn
     * const resultM1 = msbFirst.front(16n)(vector) // resultM1 is 0xF500n
     * ```
     */
    readonly front: (len: bigint) => (v: Vec) => bigint
    /**
     * Removes a specified number of bits from the start of the given vector.
     *
     * @param len - The number of bits to remove from the vector.
     * @returns A function that takes a vector and returns the remaining vector.
     *
     * @example
     *
     * ```js
     * const v = vec(16n)(0x3456n) // 0x13456n
     *
     * const rL0 = lsbFirst.removeFront(4n)(v)  // 0x1345n
     * const rL1 = lsbFirst.removeFront(24n)(v) // 0x1n
     *
     * const rM0 = msbFirst.removeFront(4n)(v)  // 0x1456n
     * const rM1 = msbFirst.removeFront(24n)(v) // 0x1n
     * ```
     */
    readonly removeFront: (len: bigint) => (v: Vec) => Vec
    /**
     * Removes a specified number of bits from the start of the vector and returns
     * the removed bits and the remaining vector.
     *
     * @param len - The number of bits to remove from the vector.
     * @returns A function that takes a vector and returns
     * a tuple containing the removed bits as an unsigned integer and the remaining vector.
     *
     * ```js
     * const vector = vec(8n)(0xF5n) // 0x1F5n
     *
     * const [uL0, rL0] = lsbFirst.popFront(4n)(vector)  // [5n, 0x1Fn]
     * const [uL1, rL1] = lsbFirst.popFront(16n)(vector) // [0xF5n, 1n]
     *
     * const [uM0, rM0] = msbFirst.popFront(4n)(vector)  // [0xFn, 0x15n]
     * const [uM1, rM1] = msbFirst.popFront(16n)(vector) // [0xF500n, 1n]
     * ```
     */
    readonly popFront: (len: bigint) => (v: Vec) => readonly[bigint, Vec]
    /**
     * Concatenates two vectors.
     *
     * @param a - The first vector.
     * @returns A function that takes a second vector and returns the concatenated vector.
     */
    readonly concat: (a: Vec) => (b: Vec) => Vec
}

/**
 * Implements operations for handling vectors in a least-significant-bit (LSB) first order.
 */
export const lsbFirst: Endian = {
    front: len => {
        const m = mask(len)
        return v => {
            const result = v & m
            return result === v ? uint(v) : result
        }
    },
    removeFront: len => v => {
        const r = v >> len
        return r === 0n ? empty : r
    },
    popFront: len => {
        const m = mask(len)
        return v => {
            const result = v & m
            return result === v ? [uint(v), empty] : [result, v >> len]
        }
    },
    concat: a => {
        const aLen = length(a)
        const m = mask(aLen)
        return b => (b << aLen) | (a & m)
    }
}

/**
 * Implements operations for handling vectors in a most-significant-bit (MSB) first order.
 */
export const msbFirst: Endian = {
    front: len => {
        const m = mask(len)
        return v => (v >> (length(v) - len)) & m
    },
    removeFront: len => v => vec(length(v) - len)(v),
    popFront: len => {
        const m = mask(len)
        return v => {
            const d = length(v) - len
            return [(v >> d) & m, vec(d)(v)]
        }
    },
    concat: flip(lsbFirst.concat)
}

/**
 * Extract the least significant unsigned integer from the given vector.
 */
export const uintLsb = (len: bigint): (v: Vec) => bigint => {
    const m = mask(len)
    return v => {
        const result = v & m
        return result === v ? uint(v) : result
    }
}

/**
 * Removes the first `len` least significant bits from the given vector.
 *
 * @example
 *
 * ```js
 * const v = vec(16n)(0x3456n) // 0x13456n
 * const r = removeLsb(4n)(v) // 0x1345n
 * const r2 = removeLsb(24n)(v) // 0x1n
 * ```
 */
export const removeLsb = (len: bigint) => (v: Vec): Vec => {
    const r = v >> len
    return r === 0n ? empty : r
}

/**
 * Extracts the least significant unsigned integer and removes it from the vector.
 *
 * @example
 *
 * ```js
 * const vector = vec(8n)(0xF5n) // 0x1F5n
 * const [result, rest] = popUintLsb(4n)(vector); // result is 5n, rest is 0x1Fn
 * const [result2, rest2] = popUintLsb(16n)(vector); // result2 is 0xF5n, rest2 is 1n
 * ```
 */
export const popUintLsb = (len: bigint): (v: Vec) => readonly[bigint, Vec] => {
    const m = mask(len)
    return v => {
        const result = v & m
        return result === v ? [uint(v), empty] : [result, v >> len]
    }
}

/**
 * Extract the most significant unsigned integer of the given `len` from the given vector.
 *
 * @example
 *
 * ```js
 * const vector = vec(8n)(0xF5n) // 0x1F5n
 * const result = uintMsb(4n)(vector); // result is 0xFn
 * const result2 = uintMsb(16n)(vector); // result2 is 0xF500n
 * ```
 */
export const uintMsb = (len: bigint): (v: Vec) => bigint => {
    const m = mask(len)
    return v => (v >> (length(v) - len)) & m
}

/**
 * Removes the first `len` most significant bits from the given vector.
 *
 * @example
 *
 * ```js
 * const v = vec(16n)(0x3456n) // 0x13456n
 * const r = removeMsb(4n)(v) // 0x1456n
 * const r2 = removeMsb(24n)(v) // 0x1n
 * ```
 */
export const removeMsb = (len: bigint) => (v: Vec): Vec => vec(length(v) - len)(v)

/**
 * Extracts the most significant unsigned integer and removes it from the vector.
 *
 * @example
 *
 * ```js
 * const vector = vec(8n)(0xF5n) // 0x1F5n
 * const [result, rest] = popUintMsb(4n)(vector); // [0xFn, 0x15n]
 * const [result2, rest2] = popUintMsb(16n)(vector); // [0xF500n, 1n]
 * ```
 */
export const popUintMsb = (len: bigint): (v: Vec) => readonly[bigint, Vec] => {
    const m = mask(len)
    return v => {
        const d = length(v) - len
        return [(v >> d) & m, vec(d)(v)]
    }
}

/**
 * Concat the given vectors of bits. The first vector is the least significant.
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
export const concatLsb = (a: Vec): (b: Vec) => Vec => {
    const aLen = length(a)
    const m = mask(aLen)
    return b => (b << aLen) | (a & m)
}

/**
 * Concat the given vectors of bits. The first vector is the most significant.
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
export const concatMsb
    : (a: Vec) => (b: Vec) => Vec
    = flip(concatLsb)
