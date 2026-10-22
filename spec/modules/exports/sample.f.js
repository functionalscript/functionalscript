/**
 * The example of [`README.md`](./README.md) (Exporting a Value) as a
 * function of one number, for the page's WASM demo: a named export beside
 * the default one.
 *
 * @module
 */

export const five = 5;
/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => five * a[0];
