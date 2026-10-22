/**
 * The example of [`README.md`](./README.md) (String Conversion) as a
 * function of one number, for the page's WASM demo: `String(exp)` of a
 * number, a `bigint`, an array and a boolean.
 *
 * @module
 */

/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => [String(a[0]), String(42n), String([1, 2]), String(a[0] > 0)];
