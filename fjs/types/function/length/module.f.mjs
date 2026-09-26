/**
 * Build a fixed/rest callable with a given `length` from a statically declared
 * parameter list. The table covers every length the language admits, 0
 * through {@link maxLength}.
 *
 * @module
 * @import { Body, Callable, Factory } from './types.ts'
 */

import { assert } from '../../../asserts/module.f.mjs'

/**
 * Arrow factories by function length, written by hand: a function's `length`
 * comes only from a written parameter list.
 *
 * @type {readonly Factory[]}
 */
export const factories = [
    g => (...rest) => g([], rest),
    g => (a0, ...rest) => g([a0], rest),
    g => (a0, a1, ...rest) => g([a0, a1], rest),
    g => (a0, a1, a2, ...rest) => g([a0, a1, a2], rest),
    g => (a0, a1, a2, a3, ...rest) => g([a0, a1, a2, a3], rest),
    g => (a0, a1, a2, a3, a4, ...rest) => g([a0, a1, a2, a3, a4], rest),
    g => (a0, a1, a2, a3, a4, a5, ...rest) => g([a0, a1, a2, a3, a4, a5], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, ...rest) => g([a0, a1, a2, a3, a4, a5, a6], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15], rest),
];

/** The most fixed parameters a FunctionalScript function has: its largest `length`. */
export const maxLength = 16

/** A canonical nonnegative integer, including positive zero only. @type {(n: number) => boolean} */
export const isIndex = n => Number.isInteger(n) && n >= 0 && !Object.is(n, -0)

/** @type {(length: number, body: Body) => Callable} */
export const callable = (length, body) => {
    assert(isIndex(length) && length <= maxLength, ['invalid function length', length])
    return factories[length](body)
}
