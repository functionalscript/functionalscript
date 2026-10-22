/**
 * The FunctionalScript spelling of [`sample.mjs`](./sample.mjs): the object a method would read through `this`, passed as a parameter
 * ([`README.md`](./README.md)).
 *
 * @module
 */

/** @type {(o: { readonly n: number }) => number} */
const get = o => o.n;
export default get({ n: 1 });
