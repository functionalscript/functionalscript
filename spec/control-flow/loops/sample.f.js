/**
 * The example of [`README.md`](./README.md) (Loops) as a function of one
 * number, for the page's WASM demo: the least power of two not below the
 * input, and the number of doublings needed to reach it.
 *
 * @module
 */

/** @type {(n: number) => readonly [number, number]} */
export default n => {
    let value = 1;
    let steps = 0;
    while (value < n) {
        value = value * 2;
        steps = steps + 1;
    }
    return [value, steps];
};
