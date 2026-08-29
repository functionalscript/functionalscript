/**
 * Types for function composition.
 *
 * @module
 */

/**
 * A generic function type.
 */
export type Func<I, O> = (_: I) => O

/**
 * A functional utility type that enables seamless chaining of transformations.
 */
export type Fn<I, O> = {
    readonly result: Func<I, O>
    readonly map: <T>(g: Func<O, T>) => Fn<I, T>
}
