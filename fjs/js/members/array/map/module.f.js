/**
 * `Array.prototype.map` over FunctionalScript's dense, immutable arrays.
 * The callback receives the element, its index and the original array; the
 * first throw ends the iteration. Arrow functions do not read `this`, so a
 * caller's optional `thisArg` has no effect.
 *
 * @module
 */

/**
 * Map every element in order, checking the callback even for an empty array.
 * Array spread preserves immutability; no member call or runtime lookup is
 * needed, so this body can be part of the common runtime itself.
 *
 * @type {(self: readonly unknown[], callback: unknown) => readonly unknown[]}
 */
export const map = (self, callback) => {
    if (typeof callback !== 'function') { throw 'Array.prototype.map: not a function' }
    /** @type {readonly unknown[]} */
    let result = []
    let i = 0
    while (i < self.length) {
        const value = callback(self[Number(i)], i, self)
        result = [...result, value]
        i += 1
    }
    return result
}
