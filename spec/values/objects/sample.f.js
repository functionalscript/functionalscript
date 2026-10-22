/**
 * The example of [`README.md`](./README.md) (Objects) as a function of one
 * number, for the page's WASM demo: an object literal with an identifier
 * key, a string key and a computed key.
 *
 * @module
 */

/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => {
    const o = { a: "hello", "b": a[0], ["c"]: [1, 2] };
    return Object.entries(o).length + o.b;
};
