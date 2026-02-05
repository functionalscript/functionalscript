export type Operations = {
    readonly [command in string]: readonly [input: unknown, output: unknown]
}

export type Effect<O extends Operations, T> = Pure<O, T> | Do<O, T>

export type Then<O extends Operations, T> = {
    readonly then: <R>(f: (_: T) => Effect<O, R>) => Effect<O, R>
}

export type Pure<O extends Operations, T> = {
    readonly pure: T
} & Then<O, T>

export const pure = <O extends Operations, T>(value: T): Pure<O, T> => ({
    pure: value,
    then: f => f(value),
})

export type One<O extends Operations, T, K extends keyof O & string> =
    readonly [K, O[K][0], (input: O[K][1]) => Effect<O, T>]

export type Do<O extends Operations, T> = {
    readonly do: { readonly [K in keyof O & string]: One<O, T, K> }[keyof O & string]
} //& Then<O, T>

const doFull = <O extends Operations, K extends keyof O & string, T>(
    cmd: K,
    payload: O[K][0],
    f: (input: O[K][1]) => Effect<O, T>
): Do<O, O[K][1]> => {
    const one: One<O, T, K> = [cmd, payload, f]
    return {
        do: one,
        /*then: f => {
            if (f === pure) {
                return [cmd, payload] as Effect<O, R & M> //< M == R
            }
        }*/
    }
}

export const do_ = <O extends Operations, K extends keyof O & string>(
    cmd: K,
    payload: O[K][0]
): Do<O, O[K][1]> =>
    doFull(cmd, payload, pure)

export const bind = <O extends Operations, M, R>(
    a: Effect<O, M>,
    f: (x: M) => Effect<O, R>
): Effect<O, R> => {
    if (f === pure) {
        return a as Effect<O, R & M> //< M == R
    }
    if ('pure' in a) {
        return f(a.pure)
    }
    const [cmd, payload, cont] = a.do
    type K = O[typeof cmd][1]
    return doFull(
        cmd,
        payload,
        cont === pure
            ? f as (x: K) => Effect<O, R> //< M == T
            : x => bind(cont(x), f)
    ) as Do<O, R>
}

export type ToAsyncOperationMap<O extends Operations> = {
    readonly [K in keyof O]: (payload: O[K][0]) => Promise<O[K][1]>
}
