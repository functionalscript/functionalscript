export type Operations = {
    readonly[command in string]: readonly[input: unknown, output: unknown]
}

export type Effect<O extends Operations, T> = Pure<T> | Do<O, T>

export type Pure<T> = readonly['pure', T]

export const pure = <T>(value: T): Pure<T> => ['pure', value]

export type One<O extends Operations, T, K extends keyof O & string> =
    readonly['do', K, O[K][0], (input: O[K][1]) => Effect<O, T>]

export type Do<O extends Operations, T> = {
    readonly[K in keyof O & string]: One<O, T, K>
}[keyof O & string]

export const do_ = <O extends Operations, K extends keyof O & string>(
    cmd: K,
    payload: O[K][0]
): Do<O, O[K][1]> =>
    ['do', cmd, payload, pure]

export type ToAsyncOperationMap<O extends Operations> = {
    readonly[K in keyof O]: (payload: O[K][0]) => Promise<O[K][1]>
}

export const bind = <O extends Operations, M, R>(a: Effect<O, M>, f: (x: M) => Effect<O, R>): Effect<O, R> => {
    if (f === pure) {
        return a as Effect<O, R>
    }
    if (a[0] === 'pure') {
        return f(a[1])
    }
    const [, cmd, payload, cont] = a
    return cont === pure
        ? ['do', cmd, payload, f as (x: unknown) => Effect<O, R>]
        : ['do', cmd, payload, x => bind(cont(x), f)]
}
