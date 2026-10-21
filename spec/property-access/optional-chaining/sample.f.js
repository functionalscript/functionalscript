/**
 * The example of [`README.md`](./README.md) (Optional Chaining) as a
 * function of one number, for the page's WASM demo: optional property reads
 * and calls on an object, and on `null`.
 *
 * @module
 */

const o = { a: { b: 1 }, f: (/** @type {readonly number[]} */ ...x) => x };
/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => {
    const v = [o, null][Number(a[0])];
    return [v?.a.b, v?.f(2), v?.f?.(3)];
};
