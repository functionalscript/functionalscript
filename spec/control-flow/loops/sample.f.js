/**
 * The example of [`README.md`](./README.md) (Loops) as a function of one
 * number, for the page's WASM demo: the one-variable `let`/`while` loop: the
 * least power of two not below the input.
 *
 * @module
 */

/** @type {(n: number) => number} */
export default n => {
    let r = 1;
    while (r < n) { r = r * 2; }
    return r;
};
