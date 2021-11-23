/**
 * @template T
 * @typedef {T|undefined} Option
 */

/** @type {<T, R>(f: (value: T) => R) => (value: T|undefined) => R|undefined} */
const map = f => value => value === undefined ? undefined : f(value)

/** @type {<T, R>(f: (_: T) => R) => (none: () => R) => (_: T|undefined) => R|undefined} */
const match = f => none => value => value === undefined ? none() : f(value)

module.exports = {
    /** @readonly */
    map,
    /** @readonly */
    match,
}