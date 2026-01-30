/**
 * Effects as Data
 * 
 * This module provides a purely functional way to represent side effects as data.
 * Effects can be composed, transformed, and tested without performing actual I/O.
 */

/**
 * An Effect is a description of a computation that may have side effects.
 * It's represented as data and only executed by an impure runner.
 */
export type Effect<T> = readonly [tag: string, payload: unknown, continuation: (result: unknown) => Effect<T>] | Pure<T>

/**
 * A Pure effect represents a value without any side effects
 */
export type Pure<T> = readonly ['pure', value: T]

/**
 * Create a pure effect from a value
 */
export const pure = <T>(value: T): Pure<T> => ['pure', value] as const

/**
 * Map over an effect's result
 */
export const map = <A, B>(f: (a: A) => B) => (effect: Effect<A>): Effect<B> => {
    const [tag, payload, cont] = effect
    if (tag === 'pure') {
        return pure(f(payload as A))
    }
    return [tag, payload, (result: unknown) => map(f)(cont(result))] as const
}

/**
 * Flat map (bind/chain) for effects
 */
export const flatMap = <A, B>(f: (a: A) => Effect<B>) => (effect: Effect<A>): Effect<B> => {
    const [tag, payload, cont] = effect
    if (tag === 'pure') {
        return f(payload as A)
    }
    return [tag, payload, (result: unknown) => flatMap(f)(cont(result))] as const
}

/**
 * Sequence an array of effects into an effect of array
 */
export const sequence = <T>(effects: readonly Effect<T>[]): Effect<readonly T[]> => {
    const go = (acc: readonly T[], remaining: readonly Effect<T>[]): Effect<readonly T[]> => {
        if (remaining.length === 0) {
            return pure(acc)
        }
        const [head, ...tail] = remaining
        return flatMap((value: T) => go([...acc, value], tail))(head)
    }
    return go([], effects)
}

/**
 * Traverse an array with an effect-producing function
 */
export const traverse = <A, B>(f: (a: A) => Effect<B>) => (arr: readonly A[]): Effect<readonly B[]> =>
    sequence(arr.map(f))

/**
 * Apply an effect of a function to an effect of a value
 */
export const ap = <A, B>(effectFn: Effect<(a: A) => B>) => (effectVal: Effect<A>): Effect<B> =>
    flatMap((fn: (a: A) => B) => map(fn)(effectVal))(effectFn)

/**
 * Lift a binary function to work with effects
 */
export const liftA2 = <A, B, C>(f: (a: A) => (b: B) => C) => (ea: Effect<A>) => (eb: Effect<B>): Effect<C> =>
    ap(map(f)(ea))(eb)

/**
 * Filter an array with an effect-producing predicate
 */
export const filterM = <T>(predicate: (t: T) => Effect<boolean>) => (arr: readonly T[]): Effect<readonly T[]> => {
    const go = (acc: readonly T[], remaining: readonly T[]): Effect<readonly T[]> => {
        if (remaining.length === 0) {
            return pure(acc)
        }
        const [head, ...tail] = remaining
        return flatMap((keep: boolean) => 
            go(keep ? [...acc, head] : acc, tail)
        )(predicate(head))
    }
    return go([], arr)
}

/**
 * Fold an array with an effect-producing function
 */
export const foldM = <A, B>(f: (acc: B) => (a: A) => Effect<B>) => (initial: B) => (arr: readonly A[]): Effect<B> => {
    const go = (acc: B, remaining: readonly A[]): Effect<B> => {
        if (remaining.length === 0) {
            return pure(acc)
        }
        const [head, ...tail] = remaining
        return flatMap((newAcc: B) => go(newAcc, tail))(f(acc)(head))
    }
    return go(initial, arr)
}

/**
 * Check if an effect is pure
 */
export const isPure = <T>(effect: Effect<T>): effect is Pure<T> => effect[0] === 'pure'

/**
 * Extract the value from a pure effect (unsafe - only for testing/introspection)
 */
export const unsafeGetPure = <T>(effect: Pure<T>): T => effect[1]
