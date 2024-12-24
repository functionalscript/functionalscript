import type { Reduce } from "../function/operator/module.f.ts";

/**
 * Represents a monoid, an algebraic structure with a binary operation
 * and an identity (neutral) element.
 *
 * A monoid satisfies the following properties:
 * 1. **Associativity**: The operation must be associative.
 *    For all `a`, `b`, and `c` in the set, `(a operation b) operation c = a operation (b operation c)`.
 *    {@link https://en.wikipedia.org/wiki/Associative_property Learn more about associativity}.
 * 2. **Identity Element**: There exists an element (called the identity) such that,
 *    when combined with any other element under the operation, it leaves the other element unchanged.
 *    {@link https://en.wikipedia.org/wiki/Identity_element Learn more about identity elements}.
 *
 * Learn more about monoids: {@link https://en.wikipedia.org/wiki/Monoid}.
 *
 * @template T The type of the elements in the monoid.
 */
type Monoid<T> = {
    /**
     * The identity (neutral) element for the monoid.
     * When combined with any value under the `operation`, it leaves the other value unchanged.
     *
     * Examples:
     * - `0` for addition
     * - `1` for multiplication
     * - `""` for string concatenation
     * - `[]` for array concatenation
     *
     * Learn more: {@link https://en.wikipedia.org/wiki/Identity_element}
     */
    readonly identity: T
    readonly isIdentity: (v: T) => boolean
    /**
     * The associative binary operation of the monoid.
     * Takes one value of type `T` and returns a function that takes another value of type `T`,
     * producing a result of type `T`.
     *
     * Examples:
     * - `(a, b) => a + b` for addition
     * - `(a, b) => a * b` for multiplication
     * - `(a, b) => a.concat(b)` for arrays or strings
     *
     * Learn more: {@link https://en.wikipedia.org/wiki/Binary_operation}
     */
    readonly operation: Reduce<T>
}

export const semigroupRepeat = <T>(operation: Reduce<T>) => (a: T) => (n: bigint) => {
    // assumption: `operation` is expensive.
    // n >= 1n
    let ai = a
    let ni = n
    // remove trailing zeros
    while ((ni & 1n) !== 1n) {
        ni >>= 1n
        ai = operation(ai)(ai)
    }
    // ni = 0b{...}1n
    ni >>= 1n
    if (ni === 0n) {
        return ai
    }
    // ni !== 0
    let result = ai
    ai = operation(ai)(ai)
    //
    while (true) {
        const one = (ni & 1n) === 1n
        ni >>= 1n
        if (one) {
            result = operation(result)(ai)
            if (ni === 0n) {
                return result
            }
        }
        ai = operation(ai)(ai)
    }
}

export const repeat
    : <T>(m: Monoid<T>) => (a: T) => (n: bigint) => T
    = ({ identity, isIdentity, operation }) => {
        const sg = semigroupRepeat(operation)
        return a => isIdentity(a) ?
            () => identity :
            n => n === 0n ? identity : sg(a)(n)
    }
