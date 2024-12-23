export type Nullable<T> = T|null

export const map
: <T, R>(f: (value: T) => R) => (value: Nullable<T>) => Nullable<R>
= f => value => value === null ? null : f(value)

export const match
: <T, R>(f: (_: T) => R) => (none: () => R) => (_: Nullable<T>) => Nullable<R>
= f => none => value => value === null ? none() : f(value)
