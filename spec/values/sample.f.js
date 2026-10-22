/**
 * The example of [`README.md`](./README.md) (Supported Value Types) as a
 * function of one number, for the page's WASM demo: one of each kind of
 * value: a number, a string, a boolean, `null`, an array, and `typeof` a
 * `bigint`.
 *
 * @module
 */

/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => [a[0], "s", true, null, [a[0]], -a[0], typeof 1n];
