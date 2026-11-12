/**
 * `String.prototype.concat` over FunctionalScript's primitive strings.
 * Each argument undergoes `ToString` in order before its text is appended.
 *
 * @module
 */

/**
 * Append each argument's string representation. The explicit `String`
 * conversion uses the string hint for objects, while adding an unknown
 * value directly would use the default hint. Primitive string addition
 * needs no member call or runtime lookup during bootstrap.
 *
 * @type {(self: string, ...items: readonly unknown[]) => string}
 */
export const concat = (self, ...items) => {
    let result = self
    for (const item of items) {
        result = result + String(item)
    }
    return result
}
