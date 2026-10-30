/**
 * The example of [`README.md`](./README.md) (`in`) as a function of one
 * number, for the page's WASM demo: `"x" in` an object that owns the
 * entry, and one that does not.
 *
 * @module
 */

/** @type {(...a: readonly number[]) => boolean} */
export default (...a) => "x" in [{ x: 1 }, {}][Number(a[0])];
