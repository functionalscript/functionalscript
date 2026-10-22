/**
 * The example of [`README.md`](./README.md) (Comments) as a function of one
 * number, for the page's WASM demo: a line comment, a JSDoc comment and a
 * block comment inside an expression.
 *
 * @module
 */

// a line comment runs to the end of the line

/** @type {(...a: readonly number[]) => number} */
export default (...a) => /* a block comment */ a[0] * 2;
