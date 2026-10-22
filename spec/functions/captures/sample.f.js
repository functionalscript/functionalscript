/**
 * The example of [`README.md`](./README.md) (Captures and Self Recursion) as
 * a function of one number, for the page's WASM demo: a closure: the inner
 * function captures the outer parameter and a module `const`.
 *
 * @module
 */

const scale = 3;
/** @type {(...x: readonly number[]) => (...y: readonly number[]) => number} */
const adder = (...x) => (...y) => x[0] + y[0] * scale;
/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => adder(a[0])(2);
