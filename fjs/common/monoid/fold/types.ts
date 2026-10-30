import type { Monoid } from "../types.ts"

export type Sized<T> = {
    readonly monoid: Monoid<T>
    readonly size: (value: T) => bigint
}

export type State<T> = {
    readonly first: T
    readonly tail: State<T>
} | null

export type Fold<T> = {
    readonly push: (v: T, state: State<T>) => State<T>
    readonly result: (state: State<T>) => T
}
