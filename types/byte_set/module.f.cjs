const { fn } = require('../function/module.f.cjs')

/** @typedef {bigint} ByteSet */
/** @typedef {number} Byte */

/** @type {(n: Byte) => (s: ByteSet) => boolean} */
const has = n => s => ((s >> BigInt(n)) & 1n) === 1n

// create a set

const empty = 0n

/** @type {(n: Byte) => ByteSet} */
const one = n => 1n << BigInt(n)

/** @type {(r: readonly[Byte, Byte]) => ByteSet} */
const range = ([b, e]) => one(e - b + 1) - 1n << BigInt(b)

// set operations

/** @type {(a: ByteSet) => (b: ByteSet) => ByteSet} */
const union = a => b => a | b

/** @type {(a: ByteSet) => (b: ByteSet) => ByteSet} */
const intersect = a => b => a & b

/** @type {(a: ByteSet) => (b: ByteSet) => ByteSet} */
const difference = a => b => intersect(a)(complement(b))

/** @type {(n: ByteSet) => ByteSet} */
const complement = n => ~n

// additional operations

const set = fn(one).then(union).result

const setRange = fn(range).then(union).result

/** @type {(n: Byte) => (s: ByteSet) => ByteSet} */
const unset = n => s => difference(s)(one(n))

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