/**
 * The FunctionalScript spelling of [`sample.mjs`](./sample.mjs): the function without the statement whose value nothing reads
 * ([`README.md`](./README.md)).
 *
 * @module
 */

/** @type {(o: { readonly x: number }) => number} */
const f = o => {
    return o.x + 1;
};
export default f({ x: 0 });
