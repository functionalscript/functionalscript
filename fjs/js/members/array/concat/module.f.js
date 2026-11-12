/**
 * `Array.prototype.concat` over FunctionalScript's dense, immutable arrays.
 * Array arguments contribute their elements, one level only; every other
 * argument contributes one value. The language has no species constructor
 * or `Symbol.isConcatSpreadable` hook.
 *
 * @module
 */

/**
 * Copy the receiver, then append each argument in order. The fresh result
 * retains element identities. Array spread and primitive type dispatch
 * keep this body independent of the runtime's member lookup.
 *
 * @type {(self: readonly unknown[], ...items: readonly unknown[]) => readonly unknown[]}
 */
export const concat = (self, ...items) => {
    /** @type {readonly unknown[]} */
    let result = [...self]
    for (const item of items) {
        result = item instanceof Array ? [...result, ...item] : [...result, item]
    }
    return result
}
