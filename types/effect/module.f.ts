export type Operations = {
    readonly [command in string]: readonly [input: unknown, output: unknown]
}

export type Effect<O extends Operations, T> = Pure<O, T> | Do<O, T>

export type Map<O extends Operations, T> = {
    readonly pipe: <R>(f: (_: T) => Effect<O, R>) => Effect<O, R>
    readonly map: <R>(f: (_: T) => R) => Effect<O, R>
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
