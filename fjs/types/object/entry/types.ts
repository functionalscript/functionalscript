/**
 * Type of the enumerable own-property reader.
 *
 * @module
 */

/**
 * Known keys of FunctionalScript records preserve their value type, including
 * optional properties. Arbitrary receivers and converted keys return unknown.
 * The typed overload assumes the key denotes an enumerable own record field.
 */
export type EntryLookup = {
    <T extends object, K extends keyof T>(a: T, b: K): T[K]
    (a: unknown, b: any): unknown
}
