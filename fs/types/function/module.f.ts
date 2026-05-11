/**
 * A generic function type.
 */
export type Func<I, O> = (_: I) => O

/**
 * A postfix compose function.
 */
export const compose
    : <I, X>(g: Func<I, X>) => <O>(f: Func<X, O>) => Func<I, O>
    = g => f => x => f(g(x))

/**
 * A generic identity function.
 */
export const identity: <T>(value: T) => T
    = value => value

/**
 * Flips the arguments of a curried function.
 */
export const flip
    : <A, B, C>(f: (a: A) => (b: B) => C) => (b: B) => (a: A) => C
    = f => b => a => f(a)(b)

/**
 * A functional utility type that enables seamless chaining of transformations.
 */
type Fn<I, O> = {
    readonly result: Func<I, O>
    readonly map: <T>(g: Func<O, T>) => Fn<I, T>
}

/**
 * Creates an `Fn` instance from a function, enabling chaining of transformations.
 */
export const fn = <I, O>(result: Func<I, O>): Fn<I, O> => ({
    result,
    map: g => fn(compose(result)(g))
})
