/**
 * The example of [`README.md`](./README.md) (Functions) as a function of one
 * number, for the page's WASM demo: a function with a rest parameter: the
 * argument count, and the first argument times ten.
 *
 * @module
 */

/** @type {(...a: readonly number[]) => unknown} */
export default (...args) => [args.length, args[0] * 10];
