/** @typedef {readonly[number,number]} Range */

/** @type {(range: Range) => (i: number) => boolean} */
const contains = ([b, e]) => i => b <= i && i <= e

module.exports = {
    /** @readonly */
    contains,
}
