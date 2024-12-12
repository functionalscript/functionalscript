// @ts-self-types="./module.f.d.mts"
/** @typedef {number} NibbleSet */
/** @typedef {number} Nibble */

export const empty = 0

export const universe = 0xFFFF

/** @type {(n: Nibble) => NibbleSet} */
const one = n => 1 << n

/** @type {(n: Nibble) => (s: NibbleSet) => boolean} */
export const has = n => s => ((s >> n) & 1) === 1

/** @type {(n: Nibble) => (s: NibbleSet) => NibbleSet} */
export const set = n => s => s | one(n)

/** @type {(n: NibbleSet) => NibbleSet} */
export const complement = s => universe ^ s

/** @type {(n: Nibble) => (s: NibbleSet) => NibbleSet} */
export const unset = n => s => s & complement(one(n))

/** @type {(r: readonly[number, number]) => NibbleSet} */
const range = ([a, b]) => one(b - a + 1) - 1 << a

/** @type {(r: readonly[number, number]) => (s: NibbleSet) => NibbleSet} */
export const setRange = r => s => s | range(r)
