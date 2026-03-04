/**
 * Core effect type constructors and combinators.
 *
 * @module
 */
export type Operations = {
    readonly [command in string]: readonly [input: unknown, output: unknown]
}

export type Effect<O extends Operations, T> = Pure<O, T> | Do<O, T>

export type Map<O extends Operations, T> = {
    readonly pipe: <O1 extends Operations, R>(f: (_: T) => Effect<O1, R>) => Effect<O | O1, R>
    readonly map: <O1 extends Operations, R>(f: (_: T) => R) => Effect<O | O1, R>
}

export type Pure<O extends Operations, T> = {
    readonly pure: T
} & Map<O, T>

export const pure = <O extends Operations, T>(value: T): Pure<O, T> => ({
    pure: value,
    pipe: e => e(value),
    map: f => pure(f(value))
})

export type One<O extends Operations, T, K extends keyof O & string> =
    readonly [K, O[K][0], (input: O[K][1]) => Effect<O, T>]

export type Do<O extends Operations, T> = {
    readonly do: { readonly [K in keyof O & string]: One<O, T, K> }[keyof O & string]
} & Map<O, T>

const doFull = <O extends Operations, K extends keyof O & string, T>(
    cmd: K,
    payload: O[K][0],
    cont: (input: O[K][1]) => Effect<O, T>
): Do<O, T> => ({
    do: [cmd, payload, cont],
    pipe: e => doFull(cmd, payload, x => cont(x).pipe(e)),
    map: f => doFull(cmd, payload, x => cont(x).map(f))
})

export const do_ = <O extends Operations, K extends keyof O & string>(
    cmd: K,
    payload: O[K][0]
): Do<O, O[K][1]> =>
    doFull(cmd, payload, pure)

export type ToAsyncOperationMap<O extends Operations> = {
    readonly [K in keyof O]: (payload: O[K][0]) => Promise<O[K][1]>
}

const empty = pure([])

// TODO: replace with either a `Do` operation or as an addition to `Pure` and `Do`.
export const all = <O extends Operations, T>(set: readonly Effect<O, T>[]): Effect<O, readonly T[]> =>
    set.reduce(
        (previous: Effect<O, readonly T[]>, current) =>
            previous.pipe(previousResult => current.map(currentResult => [...previousResult, currentResult])),
        empty)

//

export type Effect2<O extends Operations, T> = Pure2<T> | Do2<O, T>

export type Pure2<T> = readonly [T]

export type One2<O extends Operations, T, K extends keyof O & string> =
    readonly [K, O[K][0], (input: O[K][1]) => Effect2<O, T>]

export type Do2<O extends Operations, T> = { readonly [K in keyof O & string]: One2<O, T, K> }[keyof O & string]


export const pure2 = <T>(value: T): Pure2<T> => [value]

const doFull2 = <O extends Operations, K extends keyof O & string, T>(
    cmd: K ,
    payload: O[K][0],
    cont: (input: O[K][1]) => Effect2<O, T>
): Do2<O, T> =>
    [cmd, payload, cont]

export const do2 = <O extends Operations, K extends keyof O & string>(
    cmd: K,
    payload: O[K][0]
): Do2<O, O[K][1]> =>
    doFull2(cmd, payload, pure2)

export const step =
    <O extends Operations, T>(e: Effect2<O, T>) =>
    <O1 extends Operations, R>(f: (_: T) => Effect2<O1, R>): Effect2<O | O1, R> =>
{
    if (e.length === 1) {
        const [value] = e
        return f(value)
    }
    const [cmd, payload, cont] = e
    return doFull2(cmd, payload, x => step(cont(x))(f))
}

export const map =
    <O extends Operations, T>(e: Effect2<O, T>) =>
    <R>(f: (_: T) => R): Effect2<O, R> =>
    step(e)(x => pure2(f(x)))

export type Wrap<O extends Operations, T> = {
    readonly effect: Effect2<O, T>
    readonly step: <O1 extends Operations, R>(f: (_: T) => Effect2<O1, R>) => Wrap<O | O1, R>
    readonly map: <R>(f: (_: T) => R) => Wrap<O, R>
}

const wrap = <O extends Operations, T>(effect: Effect2<O, T>): Wrap<O, T> => ({
    effect,
    step: x => wrap(step(effect)(x)),
    map: x => wrap(map(effect)(x)),
})

export const begin: Wrap<{}, void> = wrap(pure2(undefined))
