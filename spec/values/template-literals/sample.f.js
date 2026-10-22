/**
 * The example of [`README.md`](./README.md) (Template Literals) as a
 * function of one number, for the page's WASM demo: a template literal with
 * two substitutions.
 *
 * @module
 */

export default (/** @type {readonly number[]} */ ...a) => `Hello, ${a[0]} world${a[0] > 1 ? "s" : ""}!`;
