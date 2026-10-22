/**
 * The FunctionalScript spelling of [`sample.mjs`](./sample.mjs): the conversion `==` makes in secret, written, and the comparison `===`, which converts nothing
 * ([`README.md`](./README.md)).
 *
 * @module
 */

/** @type {(a: number, b: string) => boolean} */
const same = (a, b) => a === Number(b);
export default same(0, "");
