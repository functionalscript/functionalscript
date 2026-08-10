/**
 * Types for the TypeScript source emitter: the `Equal` compile-time predicate
 * and the `Printer` interface.
 *
 * @module
 */

export type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
        ? true
        : false

/**
 * Functions for emitting TypeScript type expression strings.
 */
export type Printer = {
    readonly tuple: (types: readonly string[]) => string
    readonly struct: (fields: readonly (readonly [string, string])[]) => string
    readonly array: (type: string) => string
    readonly record: (type: string) => string
}
