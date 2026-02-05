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
} & Then<O, T>

const doFull = <O extends Operations, K extends keyof O & string, T>(
    cmd: K,
    payload: O[K][0],
    cont: (input: O[K][1]) => Effect<O, T>
): Do<O, O[K][1]> => {
    const result: Do<O, O[K][1]> = {
        do: [cmd, payload, cont],
        then: f => f === pure
            ? result
            : doFull(
                cmd,
                payload,
                cont === pure
                    ? f
                    : x => cont(x).then(f)
            )
    }
    return result
}

export const do_ = <O extends Operations, K extends keyof O & string>(
    cmd: K,
    payload: O[K][0]
): Do<O, O[K][1]> =>
    doFull(cmd, payload, pure)

export type ToAsyncOperationMap<O extends Operations> = {
    readonly [K in keyof O]: (payload: O[K][0]) => Promise<O[K][1]>
}
