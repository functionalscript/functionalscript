/**
 * The example of [`README.md`](./README.md) (Destructuring) as a function of
 * one number, for the page's WASM demo: an object and an array pattern in a
 * body and a fixed parameter, with array rest and a named rest parameter.
 *
 * @module
 */

/** @type {(p: readonly [number, { readonly second: number }, ...number[]], ...r: readonly number[]) => readonly unknown[]} */
const f = ([first, { second }, ...tail], ...r) => [first, second, tail, r];
/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => {
    const { x, y: [z, ...tail] } = { x: a[0], y: [a[0] * 2, a[0] * 3] };
    return f([x, { second: z }, ...tail], 3, 4);
};
