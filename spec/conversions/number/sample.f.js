/**
 * The example of [`README.md`](./README.md) (Number Conversion) as a
 * function of one number, for the page's WASM demo: `Number(exp)` of a
 * string, a hexadecimal string, a `bigint` and the empty string.
 *
 * @module
 */

/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => [Number(String(a[0])), Number("0x10"), Number(1n), Number("") + a[0]];
