/**
 * The example of [`README.md`](./README.md) (String Escapes and Quotes) as a
 * function of one number, for the page's WASM demo: a JSON escape, `\\'` in
 * single quotes, and a `\\u` escape, each string's length.
 *
 * @module
 */

/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => ["tab\there", 'it\'s', "\u0041"][Number(a[0])].length;
