import * as option from '../nullable/module.f.mjs'
const { map } = option

export type Array1<T> = readonly[T]

type Index1 = 0

export type Array2<T> = readonly[T, T]

type Tuple2<T0, T1> = readonly[T0, T1]

type Index2 = 0|1

export type Array3<T> = readonly[T, T, T]

type Tuple3<T0, T1, T2> = readonly[T0, T1, T2]

export type Index3 = 0|1|2

export type Array4<T> = readonly[T, T, T, T]

type Index4 = 0|1|2|3

export type Array5<T> = readonly[T, T, T, T, T]

export type Array8<T> = readonly[T, T, T, T, T, T, T, T]

export type Array16<T> = readonly[T, T, T, T, T, T, T, T, T, T, T, T, T, T, T, T]

type Index16 = 0|1|2|3|4|5|6|7|8|9|10|11|12|13|14|15

type Array1_5<T> = Array1<T>| Array2<T> | Array3<T> | Array4<T> | Array5<T>

export type Index5 = 0|1|2|3|4

export type KeyOf<T> = T extends Array1<infer _> ? Index1 :
    T extends Array2<infer _> ? Index2 :
    T extends Array3<infer _> ? Index3 :
    T extends Array4<infer _> ? Index4 :
    T extends Array5<infer _> ? Index5 :
    T extends readonly (infer _)[] ? number :
    never

const uncheckTail
    : <T>(_: readonly T[]) => readonly T[]
    = a => a.slice(1)

const uncheckHead
    : <T>(_: readonly T[]) => readonly T[]
    = a => a.slice(0, -1)

export const at
    : (index: number) => <T>(a: readonly T[]) => T|null
    = i => a => {
    const r = a[i]
    return r === void 0 ? null : r
}

export const first
    : <T>(_: readonly T[]) => T|null
    = at(0)

export const last
    : <T>(_: readonly T[]) => T|null
    = a => at(a.length - 1)(a)

export const tail
    : <T>(_: readonly T[]) => readonly T[] | null
    = a => a.length === 0 ? null : uncheckTail(a)

export const splitFirst
    = <T>(a: readonly T[]): readonly[T, readonly T[]]|null => {
    const split
        : (_: T) => readonly[T, readonly T[]]
        = first => [first, uncheckTail(a)]
    return map(split)(first(a))
}

export const head
    : <T>(_: readonly T[]) => readonly T[]|null
    = a => a.length === 0 ? null : uncheckHead(a)

export const splitLast
    : <T>(_: readonly T[]) => readonly[readonly T[], T]|null
    = a => {
    const lastA = last(a)
    if (lastA === null) { return null }
    return [uncheckHead(a), lastA]
}
