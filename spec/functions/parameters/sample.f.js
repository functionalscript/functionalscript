/**
 * The example of [`README.md`](./README.md) (Parameters) as a function of
 * one number, for the page's WASM demo: a fixed parameter, a default and a
 * rest parameter.
 *
 * @module
 */

/** @type {(x: number, y?: number, ...rest: readonly number[]) => readonly number[]} */
const f = (x, y = 10, ...rest) => [x, y, rest.length];
/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => [f(a[0]), f(a[0], a[0] * 2, 7, 8)];
