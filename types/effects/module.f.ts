/**
 * Core effect type constructors and combinators.
 *
 * @module
 */

export type Operation =
    readonly[string, (_: never) => unknown]

export type Effect<O extends Operation, T> = {
    value: Value<O, T>
    step: <Q extends Operation, R>(f: (p: T) => Effect<Q, R>) => Effect<O | Q, R>
}

export type Value<O extends Operation, T> =
    Pure<T> | Do<O, T>

export type Pure<T> =
    readonly[T]

export type DoKPR<O extends Operation, T, K extends string, PR extends readonly[unknown, unknown]> =
    readonly[K, PR[0], (_: PR[1]) => Effect<O, T>]

export type Pr<O extends Operation, K extends O[0]> =
    O extends readonly[K, (_: infer P) => infer R] ? readonly[P, R] : never

export type DoK<O extends Operation, T, K extends O[0]> =
    DoKPR<O, T, K, Pr<O, K>>

export type Do<O extends Operation, T> =
    DoK<O, T, O[0]>

export const pure = < T>(v: T): Effect<never, T> => ({
    value: [v],
    step: f => f(v)
})

export const doFull = <O extends Operation, T, K extends O[0]>(
    cmd: K,
    param: Pr<O, K>[0],
    cont: (input: Pr<O, K>[1]) => Effect<O, T>
): Effect<O, T> => ({
    value: [cmd, param, cont],
    step: <Q extends Operation, R>(f: (p: T) => Effect<Q, R>) =>
        doFull<O | Q, R, K>(cmd, param, x => cont(x).step(f)),
})

export type Param<O extends Operation> = F<O>[0]

export type Return<O extends Operation> = F<O>[1]

export const do_ =
    <O extends Operation>(cmd: O[0]) =>
    (param: Param<O>): Effect<O, Return<O>> =>
    doFull(cmd, param, pure)

export const doRest =
    <O extends Operation>(cmd: O[0]) =>
    (...param: Param<O>): Effect<O, Return<O>> =>
    do_(cmd)(param as Param<O>)

export const begin: Effect<never, void> = pure(undefined)

export type ToAsyncOperationMap<O extends Operation> = {
    readonly [K in O[0]]: (payload: Pr<O, K>[0]) => Promise<Pr<O, K>[1]>
}

export type F<O extends Operation> = Pr<O, O[0]>

export type Func<O extends Operation> = (_: Param<O>) => Effect<O, Return<O>>

export type RestFunc<O extends Operation> = (..._: Param<O>) => Effect<O, Return<O>>

export type ListEffect<O extends Operation, T> =
    Effect<O, readonly[T, ListEffect<O, T>] | undefined>
