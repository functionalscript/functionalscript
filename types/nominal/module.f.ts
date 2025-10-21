export type Nominal<T extends string, B> = { [k in T]: true }

export const to_nominal = <T extends string, B>(b: B): Nominal<T, B> => b as Nominal<T, B>

export const to_base = <T extends string, B>(n: Nominal<T, B>): B => n as B
