/** @typedef {bigint} ByteSet */
/** @typedef {number} Byte */

/** @type {(n: Byte) => (s: ByteSet) => boolean} */
const has = n => s => ((s >> BigInt(n)) & 1n) === 1n

/** @type {(n: Byte) => (s: ByteSet) => ByteSet} */
const set = n => s => s | (1n << BigInt(n))

/** @type {(n: Byte) => (s: ByteSet) => ByteSet} */
const unset = n => s => s & ~(1n << BigInt(n))

/** @type {(r: readonly[Byte, Byte]) => ByteSet} */
const range = ([b, e]) => (1n << BigInt(e - b + 1)) - 1n << BigInt(b)

/** @type {(a: ByteSet) => (b: ByteSet) => ByteSet} */
const union = a => b => a | b

/** @type {(r: readonly[Byte, Byte]) => (s: ByteSet) => ByteSet} */
const setRange = r => s => union(s)(range(r))

const empty = 0n

module.exports = {
    /** @readonly */
    empty,
    /** @readonly */
    has,
    /** @readonly */
    set,
    /** @readonly */
    unset,
    /** @readonly */
    union,
    /** @readonly */
    setRange,
    /** @readonly */
    range,
}