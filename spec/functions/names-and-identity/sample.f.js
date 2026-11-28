/**
 * The example of [`README.md`](./README.md) (Names and Identity) as a
 * function of one number for the page's WASM demo. The input picks one of
 * two functions with equal content, and the answer includes whether the
 * executor compares the selected function equal to `hello`.
 *
 * @module
 */

const hello = () => 0;
const o = { make: () => 0 };
/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => [hello === hello, hello === o.make, [hello, o.make][Number(a[0])] === hello];
