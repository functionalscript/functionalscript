/**
 * The FunctionalScript spelling of [`sample.mjs`](./sample.mjs): whether
 * `{}` has an own entry named `toString`, asked with the `hasEntry` helper
 * ([entries](../../property-access/entries/README.md)).
 *
 * @module
 */

/** @type {(a: object, b: string) => boolean} */
const hasEntry = (a, b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable === true;
};
export default hasEntry({}, "toString");
