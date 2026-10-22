/**
 * The example of [`README.md`](./README.md) (Bodies and Guards) as a
 * function of one number, for the page's WASM demo: a body with a `const`
 * and two terminating `if` guards.
 *
 * @module
 */

/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => {
    const n = a[0];
    if (n < 0) { return "negative"; }
    if (n > 0) { return "positive"; }
    return "zero";
};
