/**
 * Type-level assertion helpers.
 *
 * @module
 */

/**
 * Compile-time-only check: a type resolves only if it is exactly `true`.
 * Used to assert type-level properties without any runtime cost, e.g.
 * `type _ = Assert<Equal<A, B>>`.
 */
export type Assert<T extends true> = T
