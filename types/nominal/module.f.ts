export type Nominal<T extends string, B> = { [k in T]: true }

export const as_nominal = <T extends string, B>(b: B): Nominal<T, B> => b as Nominal<T, B>

export const as_base = <T extends string, B>(n: Nominal<T, B>): B => n as B
