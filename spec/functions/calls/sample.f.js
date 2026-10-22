/**
 * The example of [`README.md`](./README.md) (Calls) as a function of one
 * number, for the page's WASM demo: a call of a call, and a method call with
 * a spread argument.
 *
 * @module
 */

/** @type {(...x: readonly number[]) => (...y: readonly number[]) => number} */
const add = (...x) => (...y) => x[0] + y[0];
const o = { m: (/** @type {readonly number[]} */ ...v) => [v.length, ...v] };
/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => [add(a[0])(10), o.m(...[a[0], 4], 5)];
