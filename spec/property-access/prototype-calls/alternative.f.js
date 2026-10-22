/**
 * The FunctionalScript spelling of [`sample.mjs`](./sample.mjs): whether `{ a: 1 }` owns `a`, asked with the `hasEntry` helper
 * ([`README.md`](./README.md)).
 *
 * @module
 */

/** @type {(a: object, b: string) => boolean} */
const hasEntry = (a, b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable === true;
};
export default hasEntry({ a: 1 }, "a");
