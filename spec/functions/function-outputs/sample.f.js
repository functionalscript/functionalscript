/**
 * The example of [`README.md`](./README.md) (Function Outputs) as a function
 * of one number, for the page's WASM demo: a function as a value: its
 * `length`, and a call of it.
 *
 * @module
 */

/** @type {(a: number, b: number) => number} */
const f = (a, b) => a + b;
/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => [f.length, f(a[0], 1)];
