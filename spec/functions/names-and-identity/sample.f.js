/**
 * The example of [`README.md`](./README.md) (Names and Identity) as a
 * function of one number, for the page's WASM demo: identity, not names: a
 * function is equal to itself, and two written alike are two functions.
 *
 * @module
 */

const hello = () => 0;
const o = { make: () => 0 };
/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => [hello === hello, hello === o.make, [hello, o.make][Number(a[0])]()];
