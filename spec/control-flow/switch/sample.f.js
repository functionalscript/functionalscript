/**
 * The example of [`README.md`](./README.md) (Switch) as a function of one
 * number, for the page's WASM demo: a terminating `switch` with a shared
 * `case`, and a `default` that throws.
 *
 * @module
 */

const kinds = ["array", "object", "string"];
/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => {
    switch (kinds[Number(a[0])]) {
        case "array": case "object": { return "container"; }
        case "string": { return "text"; }
        default: { throw ["unknown", a[0]]; }
    }
};
