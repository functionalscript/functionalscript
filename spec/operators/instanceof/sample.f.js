/**
 * The example of [`README.md`](./README.md) (`instanceof`) as a function of
 * one number, for the page's WASM demo: `instanceof Array` of an array, and
 * of a number.
 *
 * @module
 */

/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => [[a[0]], a[0]][Number(a[0])] instanceof Array;
