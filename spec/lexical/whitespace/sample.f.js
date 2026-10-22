/**
 * The example of [`README.md`](./README.md) (Whitespace and Line
 * Terminators) as a function of one number, for the page's WASM demo: tabs,
 * spaces and line breaks between the tokens of one expression.
 *
 * @module
 */

/** @type {(...a: readonly number[]) => unknown} */
export default (...a) =>
	a[0]
    +
	1;
