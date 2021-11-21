/**
 * @template T
 * @typedef {T|undefined} Option
 */

/** @type {<T, R>(_: (_: T) => R) => (_: T|undefined) => R|undefined} */
const map = f => x => x === undefined ? undefined : f(x)

module.exports = {
    /** @readonly */
    map,
}