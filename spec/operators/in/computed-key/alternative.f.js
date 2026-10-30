/**
 * The FunctionalScript spelling of [`sample.mjs`](./sample.mjs): the
 * `hasEntry` helper, which tests a key computed at run time
 * ([`README.md`](./README.md)).
 *
 * @module
 */

/** @type {(a: object, b: string) => boolean} */
const hasEntry = (a, b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable === true;
};
const k = "a";
export default hasEntry({ a: 1 }, k);
