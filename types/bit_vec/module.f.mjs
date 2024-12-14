// @ts-self-types="./module.f.d.mts"
import { log2 } from '../bigint/module.f.mjs'

/**
 * @typedef {bigint} Vec
 */

export const empty = 1n

export const len = log2

/**
 * Extract an unsigned integer of the given `uintLen` from the given vector.
 *
 * @type {(uintLen: bigint) => (v: Vec) => bigint}
 */
export const uint = vecLen => {
    const mask = (1n << vecLen) - 1n
    return data => data & mask
}

/**
 * The function creates a vector of bits of the given `vecLen` from the given unsigned integer.
 *
 * @type {(vecLen: bigint) => (ui: bigint) => Vec}
 */
export const vec = vecLen => {
    const stop = 1n << vecLen
    const mask = stop - 1n
    return data => (data & mask) | stop
}

/**
 * @type {(a: Vec) => (b: Vec) => Vec}
 */
export const appendBack = a => {
    const aLen = len(a)
    return b => a | (b << aLen)
}

/**
 * @type {(len: bigint) => (v: Vec) => Vec}
 */
export const removeFront = len => v => {
    const r = v >> len
    return r === 0n ? empty : r
}
