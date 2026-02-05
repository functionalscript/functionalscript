export type Operations = {
    readonly [command in string]: readonly [input: unknown, output: unknown]
}

export type Effect<O extends Operations, T> = Pure<T> | Do<O, T>

export type Pure<T> = {
    readonly pure: T
}

export const pure = <T>(value: T): Pure<T> => ({ pure: value })

export type One<O extends Operations, T, K extends keyof O & string> =
    readonly [K, O[K][0], (input: O[K][1]) => Effect<O, T>]

export type Do<O extends Operations, T> = {
    readonly do: { readonly [K in keyof O & string]: One<O, T, K> }[keyof O & string]
}

const doFull = <O extends Operations, K extends keyof O & string, T>(
    cmd: K,
    payload: O[K][0],
    f: (input: O[K][1]) => Effect<O, T>
): Do<O, O[K][1]> =>
    ({ do:  [cmd, payload, f] })

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
    type T = O[typeof cmd][1]
    return {
        do: [
            cmd,
            payload,
            cont === pure
                ? f as (x: T) => Effect<O, R> //< M == T
                : x => bind(cont(x), f)
        ]
    }
}

export type ToAsyncOperationMap<O extends Operations> = {
    readonly [K in keyof O]: (payload: O[K][0]) => Promise<O[K][1]>
}
