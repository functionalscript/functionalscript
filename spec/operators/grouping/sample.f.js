/**
 * The example of [`README.md`](./README.md) (Grouping) as a function of one
 * number, for the page's WASM demo: parentheses that change precedence, and
 * a group a step applies to.
 *
 * @module
 */

/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => [(a[0] + 2) * 3, a[0] + 2 * 3, ([80, 443]).length];
