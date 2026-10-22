/**
 * The comma operator's assertion form, the example of
 * [`README.md`](./README.md): `a[0] + 2`
 * where `a[0] >= 0` holds, and the assertion's failure where it does not.
 *
 * @module
 */

/** @type {(...a: readonly unknown[]) => undefined} */
const assert = (...a) => a[0] ? undefined : (() => { throw a[1]; })();
/** @type {(...a: readonly number[]) => number} */
export default (...a) => (assert(a[0] >= 0, "negative"), a[0] + 2);
