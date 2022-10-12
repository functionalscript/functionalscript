/** @typedef {number} nibbleSet */
/** @typedef {number} nibble */

const empty = 0

const universe = 0xFFFF

/** @type {(n: nibble) => (s: nibbleSet) => boolean} */
const has = n => s => ((s >> n) & 1) === 1

/** @type {(n: nibble) => (s: nibbleSet) => nibbleSet} */
const set = n => s => s | (1 << n)

/** @type {(n: nibble) => (s: nibbleSet) => nibbleSet} */
const unset = n => s => s & ~(1 << n)

/** @type {(r: readonly[number, number]) => (s: nibbleSet) => nibbleSet} */
 const setRange = r => s => s | (((1 << (r[1] - r[0] + 1)) - 1 << r[0]))

// how to define FA???
// const stateA = [init, set] ????

module.exports = {
    /** @readonly */
    empty,
    /** @readonly */
    universe,
    /** @readonly */
    has,
    /** @readonly */
    set,
    /** @readonly */
    unset,
    /** @readonly */
    setRange
}