/**
 * The example of [`README.md`](./README.md) (Built-in Static Functions) as a
 * function of one number, for the page's WASM demo: the static functions as
 * values: `Object.is`, the `Number` predicates, `Object.entries` and
 * binary32 rounding with `Math.fround`.
 *
 * @module
 */

const { is } = Object;
const { isInteger } = Number;
/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => [is(a[0], -0), isInteger(a[0]), Number.isFinite(1 / a[0]), Object.entries({ b: a[0], "0": 2 }), Math.fround(a[0])];
