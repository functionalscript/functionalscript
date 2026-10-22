/**
 * The FunctionalScript spelling of [`sample.mjs`](./sample.mjs): the same export under a name a promise does not read
 * ([`README.md`](./README.md)).
 *
 * @module
 */

/** @type {(resolve: (value: number) => void) => void} */
export const next = resolve => resolve(1);
export default 0;
