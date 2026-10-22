/**
 * The example of [`README.md`](./README.md) (Reading an Entry at Run Time)
 * as a function of one number, for the page's WASM demo: reading an entry at
 * run time: one that exists, and one that does not.
 *
 * @module
 */

/** @type {(a: object, b: string) => unknown} */
const entry = (a, b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable ? x.value : undefined;
};
const escapes = { n: "newline", t: "tab" };
/** @type {(...a: readonly number[]) => unknown} */
export default (...c) => entry(escapes, ["n", "x"][Number(c[0])]);
