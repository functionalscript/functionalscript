export type Operations = {
    readonly[command in string]: readonly[unknown, unknown]
}

export type Effect<O extends Operations, T> = Pure<T> | Do<O, T>

export type Pure<T> = readonly['pure', T]

export type DoOperation<O extends Operations, T, K extends keyof O> =
    readonly['do', K, O[K][0], (input: O[K][1]) => Effect<O, T>]

export type Do<O extends Operations, T> = { readonly[K in keyof O]: DoOperation<O, T, K> }[keyof O]

export type ToAsyncOperationMap<O extends Operations> = {
    readonly[K in keyof O]: (payload: O[K][0]) => Promise<O[K][1]>
}
