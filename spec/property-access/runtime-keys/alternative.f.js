/**
 * The FunctionalScript spelling of [`sample.mjs`](./sample.mjs): the same read, with the key written as the number it is
 * ([`README.md`](./README.md)).
 *
 * @module
 */

/** @type {(a: readonly string[], i: number) => string | undefined} */
const at = (a, i) => a[Number(i)];
export default at(["x", "y"], 1);
