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

export const do_ = <O extends Operations, T, K extends keyof O & string>(
    cmd: K,
    payload: O[K][0],
    k: (input: O[K][1]) => Effect<O, T>
): Do<O, T> =>
    ['do', cmd, payload, k]

export type ToAsyncOperationMap<O extends Operations> = {
    readonly[K in keyof O]: (payload: O[K][0]) => Promise<O[K][1]>
}
