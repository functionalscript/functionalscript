/**
 * The example of [`README.md`](./README.md) (Destructuring) as a function of
 * one number, for the page's WASM demo: an object and an array pattern in a
 * body, and patterns and a rest in a parameter list.
 *
 * @module
 */

/** @type {(p: readonly [number, { readonly second: number }], ...r: readonly number[]) => readonly unknown[]} */
const f = ([first, { second }], ...r) => [first, second, r];
/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => {
    const { x, y: [z] } = { x: a[0], y: [a[0] * 2] };
    return f([x, { second: z }], 3, 4);
};
