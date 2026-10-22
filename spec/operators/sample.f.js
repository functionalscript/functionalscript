/**
 * The example of [`README.md`](./README.md) (Operators) as a function of one
 * number, for the page's WASM demo: the arithmetic, bitwise, logical,
 * `typeof` and conditional operators.
 *
 * @module
 */

/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => [a[0] + 2 * 3, 7 % a[0], 2 ** a[0], ~a[0], !a[0], typeof a[0], a[0] > 1 ? "big" : "small"];
