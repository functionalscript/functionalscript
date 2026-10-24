/**
 * The example of [`README.md`](./README.md) (Arrays) as a function of one
 * number, for the page's WASM demo: an array literal, a spread into another,
 * and an element read.
 *
 * @module
 */

/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => {
    /** @type {readonly [string, number, readonly [boolean, null]]} */
    const x = ["hello", a[0], [true, null]];
    return [x.length, [...x, a[0] + 1], x[2][0]];
};
