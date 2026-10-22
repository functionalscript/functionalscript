/**
 * The example of [`README.md`](./README.md) (Strings) as a function of one
 * number, for the page's WASM demo: strings in double quotes and in single
 * quotes.
 *
 * @module
 */

/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => ["hello!", 'hi!'][Number(a[0])].length;
