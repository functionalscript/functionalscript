/**
 * Build a fixed/rest callable with a given `length` from a statically declared
 * parameter list. The table supports lengths 0 through 32; this is an executor
 * resource limit.
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
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30], rest),
    g => (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31, ...rest) => g([a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14, a15, a16, a17, a18, a19, a20, a21, a22, a23, a24, a25, a26, a27, a28, a29, a30, a31], rest),
];

/** A canonical nonnegative integer, including positive zero only. @type {(n: number) => boolean} */
export const isIndex = n => Number.isInteger(n) && n >= 0 && !Object.is(n, -0)

/** @type {(length: number, body: Body) => Callable} */
export const callable = (length, body) => {
    assert(isIndex(length), ['invalid function length', length])
    const factory = factories[length]
    assert(factory !== undefined, ['function length exceeds executor capacity', length, factories.length - 1])
    return factory(body)
}
