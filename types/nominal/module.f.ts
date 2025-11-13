/// Nominal type.
///
/// It doesn't allow `===` between different nominal types.
/// It doesn't allow `<`, `>`, `<=`, `>=` comparisons at all.
export type Nominal<N extends string, R extends string, B> = symbol & {[k in N]: readonly[R, B]}

/// note: It should compiles into `identity` and no-ops at runtime.
export const asNominal = <N extends string, R extends string, B>(b: B): Nominal<N, R, B> => b as Nominal<N, R, B>

/// note: It should compiles into `identity` and no-ops at runtime.
export const asBase = <T extends string, R extends string, B>(n: Nominal<T, R, B>): B => n as B
