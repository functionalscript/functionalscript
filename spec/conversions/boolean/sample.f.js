/**
 * The example of [`README.md`](./README.md) (Boolean Conversion): scalar and
 * container truthiness through the common runtime's double negation body.
 *
 * @module
 */

/** @type {(...a: readonly number[]) => unknown} */
export default (...a) => [Boolean(a[0]), Boolean(), Boolean("false"), Boolean([]), Boolean({})];
