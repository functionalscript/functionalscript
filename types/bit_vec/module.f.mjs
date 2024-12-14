import { log2 } from '../bigint/module.f.d.mts'

/**
 * @typedef {bigint} BitSet
 */

export const empty = 1n

export const length = log2

/**
 * @type {(len: bigint) => (data: bigint) => bigint}
 */
export const uint = len => {
    const mask = (1n << len) - 1n
    return data => data & mask
}

/**
 * @type {(len: bigint) => (data: bigint) => bigint}
 */
export const vec = len => {
    const stop = 1n << len
    const mask = stop - 1n
    return data => (data & mask) | stop
}

/**
 * @type {(a: BitSet) => (b: BitSet) => BitSet}
 */
export const append = a => {
    const aLength = length(a)
    return b => a | (b >> aLength)
}
