/**
 * The FunctionalScript spelling of [`sample.mjs`](./sample.mjs): what `{}` owns under the name `toString`, read with the `entry` helper
 * ([`README.md`](./README.md)).
 *
 * @module
 */

/** @type {(a: object, b: string) => unknown} */
const entry = (a, b) => {
    const x = Object.getOwnPropertyDescriptor(a, b);
    return x?.enumerable ? x.value : undefined;
};
export default typeof entry({}, "toString");
