/** @typedef {bigint} ByteSet */
/** @typedef {number} Byte */

/** @type {(n: Byte) => (s: ByteSet) => boolean} */
const has = n => s => ((s >> BigInt(n)) & 1n) === 1n

// create a set

const empty = 0n

/** @type {(n: Byte) => ByteSet} */
const one = n => 1n << BigInt(n)

/** @type {(r: readonly[Byte, Byte]) => ByteSet} */
const range = ([b, e]) => (1n << BigInt(e - b + 1)) - 1n << BigInt(b)

// set operations

/** @type {(a: ByteSet) => (b: ByteSet) => ByteSet} */
const union = a => b => a | b

// additional operations

/** @type {(n: Byte) => (s: ByteSet) => ByteSet} */
const set = n => s => s | one(n)

/** @type {(n: Byte) => (s: ByteSet) => ByteSet} */
const unset = n => s => s & ~(1n << BigInt(n))

/** @type {(r: readonly[Byte, Byte]) => (s: ByteSet) => ByteSet} */
const setRange = r => s => union(s)(range(r))

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