/**
 * @template T
 * @typedef {T|null} Nullable
 */

/** @type {<T, R>(f: (value: T) => R) => (value: Nullable<T>) => Nullable<R>} */
const map = f => value => value === null ? null : f(value)

/** @type {<T, R>(f: (_: T) => R) => (none: () => R) => (_: Nullable<T>) => Nullable<R>} */
const match = f => none => value => value === null ? none() : f(value)

module.exports = {
    /** @readonly */
    map,
    /** @readonly */
    match,
}