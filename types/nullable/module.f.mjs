// @ts-self-types="./module.f.d.mts"
/**
 * @template T
 * @typedef {T|null} Nullable
 */

/** @type {<T, R>(f: (value: T) => R) => (value: Nullable<T>) => Nullable<R>} */
export const map = f => value => value === null ? null : f(value)

/** @type {<T, R>(f: (_: T) => R) => (none: () => R) => (_: Nullable<T>) => Nullable<R>} */
export const match = f => none => value => value === null ? none() : f(value)
