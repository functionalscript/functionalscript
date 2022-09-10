/** @typedef {bigint} byteSet */
/** @typedef {number} byte */

const empty = 0n

/** @type {(n: byte) => (s: byteSet) => boolean} */
const has = n => s => ((s >> BigInt(n)) & 1n) === 1n

/** @type {(n: byte) => (s: byteSet) => byteSet} */
const set = n => s => s | (1n << BigInt(n))

/** @type {(n: byte) => (s: byteSet) => byteSet} */
const unset = n => s => s & ~(1n << BigInt(n))

/** @type {(r: readonly[number, number]) => (s: byteSet) => byteSet} */
 const setRange = r => s => s | ((1n << BigInt(r[1] - r[0] + 1)) - 1n << BigInt(r[0]))

// how to define FA???
// const stateA = [init, set] ????

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
    setRange
}