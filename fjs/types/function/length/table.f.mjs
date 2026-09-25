/**
 * Arrow factories by function length, written by hand: a function's `length`
 * comes only from a written parameter list.
 *
 * @module
 * @import { Factory } from './types.ts'
 */

/** @type {readonly Factory[]} */
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
