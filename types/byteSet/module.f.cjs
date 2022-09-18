/** @typedef {bigint} ByteSet */
/** @typedef {number} Byte */

/** @type {(n: Byte) => (s: ByteSet) => boolean} */
const has = n => s => ((s >> BigInt(n)) & 1n) === 1n

/** @type {(n: Byte) => (s: ByteSet) => ByteSet} */
const set = n => s => s | (1n << BigInt(n))

/** @type {(n: Byte) => (s: ByteSet) => ByteSet} */
const unset = n => s => s & ~(1n << BigInt(n))

/** @type {(r: readonly[number, number]) => (s: ByteSet) => ByteSet} */
 const setRange = ([b, e]) => s => s | ((1n << BigInt(e - b + 1)) - 1n << BigInt(b))

// how to define FA???
// const stateA = [init, set] ????

module.exports = {
    /** @readonly */
    empty: 0n,
    /** @readonly */
    has,
    /** @readonly */
    set,
    /** @readonly */
    unset,
    /** @readonly */
    setRange
}