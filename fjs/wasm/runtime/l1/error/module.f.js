/**
 * The values L1 throws, each copied from the NaNVM constructor of the same
 * name in [`error.rs`](../../../../../nanvm/lib/src/vm/error.rs): a body
 * and the native it substitutes for throw the same value. A thrown value is
 * a string for now, the name of the error, a colon and the message, as in
 * NaNVM. [`proof.mjs`](./proof.mjs) reads `error.rs` and checks that each
 * entry has a constructor of the same name with the same text.
 *
 * Only the cases L1 throws so far are here. A case joins with its first
 * throw.
 *
 * @module
 */

/** The thrown values by NaNVM constructor name, in camel case. */
export const error = /** @type {const} */ ({
    unexpectedType: 'TypeError: unexpected type',
    nullishToObject: 'TypeError: Cannot convert undefined or null to object',
    bigintToNumber: 'TypeError: Cannot convert a BigInt value to a number',
    cannotConvertToPrimitive: 'TypeError: Cannot convert to primitive value',
    functionText: 'TypeError: Cannot convert a function to its text',
    mixedNumericOperands: 'TypeError: Cannot mix BigInt and other types, use explicit conversions',
    notIterable: 'TypeError: value is not iterable',
    divisionByZero: 'RangeError: Division by zero',
})
