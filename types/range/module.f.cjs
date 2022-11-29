/** @typedef {readonly[number,number]} Range */

/** @type {(range: Range) => (i: number) => boolean} */
const contains = ([b, e]) => i => b <= i && i <= e

/** @type {(i: number) => Range} */
const one = a => [a, a]

module.exports = {
    /** @readonly */
    contains,
    /** @readonly */
    one,
}
