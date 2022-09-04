/** @typedef {bigint} byteSet */
/** @typedef {number} byte */

/** @type {(n: byte) => (s: byteSet) => boolean} */
const has = n => s => ((s >> BigInt(n)) & 1n) === 1n

/** @type {(n: byte) => (s: byteSet) => byteSet} */
const set = n => s => s | (1n << BigInt(n))

/** @type {(n: byte) => (s: byteSet) => byteSet} */
// const unset = n => s =>

/** @type {(r: readonly[number, number]) => (s: byteSet) => byteSet} */
// const setRange = r => s =>

// how to define FA???
// const stateA = [init, set] ????

module.exports = {
    /** @readonly */
    has,
    /** @readonly */
    set,
}