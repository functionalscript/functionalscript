/** @typedef {number} NibbleSet */
/** @typedef {number} Nibble */

const empty = 0

const universe = 0xFFFF

/** @type {(n: Nibble) => NibbleSet} */
const one = n => 1 << n

/** @type {(n: Nibble) => (s: NibbleSet) => boolean} */
const has = n => s => ((s >> n) & 1) === 1

/** @type {(n: Nibble) => (s: NibbleSet) => NibbleSet} */
const set = n => s => s | one(n)

/** @type {(n: NibbleSet) => NibbleSet} */
const complement = s => universe ^ s

/** @type {(n: Nibble) => (s: NibbleSet) => NibbleSet} */
const unset = n => s => s & complement(one(n))

/** @type {(r: readonly[number, number]) => NibbleSet} */
const range = ([a, b]) => one(b - a + 1) - 1 << a

/** @type {(r: readonly[number, number]) => (s: NibbleSet) => NibbleSet} */
const setRange = r => s => s | range(r)

export default {
    /** @readonly */
    empty,
    /** @readonly */
    universe,
    /** @readonly */
    has,
    /** @readonly */
    complement,
    /** @readonly */
    set,
    /** @readonly */
    unset,
    /** @readonly */
    setRange,
}