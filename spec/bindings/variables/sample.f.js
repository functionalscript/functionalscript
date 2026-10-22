/**
 * The example of [`README.md`](./README.md) (Variables) as a function of
 * one number, for the page's WASM demo: two `let`s, one with a pattern, and
 * assignments in the body and in a guard's block, to the `let`s and to a
 * parameter.
 *
 * @module
 */

/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => {
    let n = a[0];
    let [sum, count] = [0, 0];
    sum = sum + n;
    count = count + 1;
    if (n < 0) { sum = -sum; return [sum, count]; }
    n = n * 2;
    return [sum, count, n];
};
