/**
 * The example of [`README.md`](./README.md) (Built-in Member Functions) as a
 * function of one number, for the page's WASM demo: array member functions
 * chained: `filter`, `map` and `join`.
 *
 * @module
 */

/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => [1, 2, 3, 4].filter(x => x > a[0]).map(x => x * 10).join("-");
