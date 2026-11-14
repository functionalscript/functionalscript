/**
 * The `fjs:l1-native` imports as a JavaScript host gives them.
 *
 * @module
 */

/**
 * The functions of the `fjs:l1-native` imports that [the interface of L1's
 * native rows](../module.f.mjs) binds: a value of `any` on its handle, as
 * the WebAssembly JavaScript API passes an `i64`, a `bigint`, and a float
 * as the number it is. A `bool` goes back as `0` or `1`.
 */
export type Host = {
    readonly bigintEquals: (a: bigint, b: bigint) => 0 | 1
    readonly numberRemainder: (a: number, b: number) => number
}
