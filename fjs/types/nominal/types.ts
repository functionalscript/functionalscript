/**
 * Types for nominal typing (branded TypeScript types).
 *
 * @module
 */

/**
 * Nominal type.
 *
 * It doesn't allow `===` between different nominal types.
 * It doesn't allow `<`, `>`, `<=`, `>=` comparisons at all.
 */
export type Nominal<N extends string, R extends string, B> =
    symbol & { [k in N]: readonly [R, B] }
