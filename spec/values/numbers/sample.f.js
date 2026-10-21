/**
 * The example of [`README.md`](./README.md) (Numbers) as a function of one
 * number, for the page's WASM demo: number literals: an integer, a fraction,
 * and exponent forms.
 *
 * @module
 */

/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => [0, -42.5, 3e2, 1E-7][Number(a[0])] * 2;
