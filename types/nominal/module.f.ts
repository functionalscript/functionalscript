declare const brand: unique symbol;

export type Nominal<T extends string, B> = symbol & {[k in T]: true}

/// note: It should compiles into `identity` and no-ops at runtime.
export const asNominal = <T extends string, B>(b: B): Nominal<T, B> => b as Nominal<T, B>

/// note: It should compiles into `identity` and no-ops at runtime.
export const asBase = <T extends string, B>(n: Nominal<T, B>): B => n as B
