/**
 * The `fjs:l1-native` imports as a JavaScript host gives them.
 *
 * @module
 */

/**
 * The functions of the `fjs:l1-native` imports that [the interface of L1's
 * native rows](../module.f.js) binds: a value of `any` on its handle, as
 * the WebAssembly JavaScript API passes an `i64`, a `bigint`, and a float
 * as the number it is. A `bool` goes back as `0` or `1`.
 */
export type Host = {
    readonly bigintEquals: (a: bigint, b: bigint) => 0 | 1
    readonly numberRemainder: (a: number, b: number) => number
    readonly numberShiftRight: (a: number, b: number) => number
    readonly numberAnd: (a: number, b: number) => number
    readonly numberToString: (n: number) => bigint
    readonly stringToNumber: (s: bigint) => number
    readonly bigintToString: (b: bigint) => bigint
    readonly bigintAdd: (a: bigint, b: bigint) => bigint
    readonly bigintSubtract: (a: bigint, b: bigint) => bigint
    readonly bigintMultiply: (a: bigint, b: bigint) => bigint
    readonly bigintDivide: (a: bigint, b: bigint) => bigint
    readonly bigintNegate: (a: bigint) => bigint
    readonly bigintRemainder: (a: bigint, b: bigint) => bigint
    readonly bigintShiftRight: (a: bigint, b: bigint) => bigint
    readonly bigintAnd: (a: bigint, b: bigint) => bigint
    readonly bigintLess: (a: bigint, b: bigint) => number
}
