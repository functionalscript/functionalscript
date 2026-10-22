/**
 * The example of [`README.md`](./README.md) (Bigints) as a function of one
 * number, for the page's WASM demo: `bigint` literals, arithmetic on one,
 * and its `typeof`.
 *
 * @module
 */

/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => [[0n, 34n, -34n][Number(a[0])] * 2n, typeof 34n];
