/**
 * The example of [`README.md`](./README.md) (Property Access) as a function
 * of one number, for the page's WASM demo: a property read with `.`, a
 * computed index, and a string key.
 *
 * @module
 */

const cfg = { ports: [80, 443] };
/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => [cfg.ports[Number(a[0])], cfg["ports"].length];
