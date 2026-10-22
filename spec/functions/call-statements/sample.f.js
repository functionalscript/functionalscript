/**
 * The example of [`README.md`](./README.md) (Call Statements) as a function
 * of one number, for the page's WASM demo: a call statement in a body: an
 * assertion that holds for `2` and fails for `5`.
 *
 * @module
 */

/** @type {(...a: readonly unknown[]) => undefined} */
const assert = (...a) => a[0] ? undefined : (() => { throw a[1]; })();
/** @type {(a: readonly number[], i: number) => number | undefined} */
const at = (a, i) => {
    assert(i < a.length, "out of range");
    return a.at(i);
};
/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => at([1, 2, 3], a[0]);
