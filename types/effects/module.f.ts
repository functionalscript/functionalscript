/**
 * Core effect type constructors and combinators.
 *
 * @module
 */

import { todo } from "../../dev/module.f.ts"

export type Operation =
    readonly[string, (_: never) => unknown]

export type Effect2<O extends Operation, T> = {
    value: Value<O, T>
    step: <Q extends Operation, R>(f: (p: T) => Effect2<Q, R>) => Effect2<O | Q, R>
}

export type Value<O extends Operation, T> =
    Pure2<T> | Do2<O, T>

export type Pure2<T> =
    readonly[T]

export type DoKPR<O extends Operation, T, K extends string, PR extends readonly[unknown, unknown]> =
    readonly[K, PR[0], (_: PR[1]) => Effect2<O, T>]

export type Pr<O extends Operation, K extends O[0]> =
    O extends readonly[K, (_: infer P) => infer R] ? readonly[P, R] : never

export type DoK<O extends Operation, T, K extends O[0]> =
    DoKPR<O, T, K, Pr<O, K>>

export type Do2<O extends Operation, T> =
    DoK<O, T, O[0]>

export const pure2 = <O extends Operation, T>(v: T): Effect2<O, T> => ({
    value: [v],
    step: f => f(v)
})

export const do2 = <O extends Operation, T, K extends O[0]>(
    cmd: K,
    param: Pr<O, K>[0],
    cont: (input: Pr<O, K>[1]) => Effect2<O, T>
): Effect2<O, T> => ({
    value: [cmd, param, cont],
    step: <Q extends Operation, R>(f: (p: T) => Effect2<Q, R>) =>
        do2<O | Q, R, K>(cmd, param, x => cont(x).step(f)),
})

//-----------------

export type Operations = {
    readonly [command in string]: readonly [input: unknown, output: unknown]
}

export type Effect<O extends Operations, T> = Pure<O, T> | Do<O, T>

export type Pure<O, T> = readonly [T]

export type One<O extends Operations, T, K extends keyof O & string> =
    readonly [K, O[K][0], (input: O[K][1]) => Effect<O, T>]

export type Do<O extends Operations, T> = { readonly [K in keyof O & string]: One<O, T, K> }[keyof O & string]

export const pure = <O extends Operations, T>(value: T): Pure<O, T> => [value]

const doFull = <O extends Operations, K extends keyof O & string, T>(
    cmd: K,
    payload: O[K][0],
    cont: (input: O[K][1]) => Effect<O, T>
): Do<O, T> =>
    [cmd, payload, cont]

export const do_ = <O extends Operations, K extends keyof O & string>(
    cmd: K,
    payload: O[K][0]
): Do<O, O[K][1]> =>
    doFull(cmd, payload, pure)

export type ToAsyncOperationMap<O extends Operations> = {
    readonly [K in keyof O]: (payload: O[K][0]) => Promise<O[K][1]>
}

export const step =
    <O extends Operations, T>(e: Effect<O, T>) =>
    <O1 extends Operations, R>(f: (_: T) => Effect<O1, R>): Effect<O | O1, R> =>
{
    if (e.length === 1) {
        const [value] = e
        return f(value)
    }
    const [cmd, payload, cont] = e
    return doFull(cmd, payload, x => step(cont(x))(f))
}

export const map =
    <O extends Operations, T>(e: Effect<O, T>) =>
    <R>(f: (_: T) => R): Effect<O, R> =>
    step(e)(x => pure(f(x)))

export type Fluent<O extends Operations, T> = {
    readonly effect: Effect<O, T>
    readonly step: <O1 extends Operations, R>(f: (_: T) => Effect<O1, R>) => Fluent<O | O1, R>
}

const wrap = <O extends Operations, T>(effect: Effect<O, T>): Fluent<O, T> => ({
    effect,
    step: x => wrap(step(effect)(x)),
})

export const fluent: Fluent<{}, void> = wrap(pure(undefined))

const empty: Effect<{}, readonly never[]> = pure([])
