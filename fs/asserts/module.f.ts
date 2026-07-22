/**
 * Assertion helpers for runtime checks and compile-time type-level tests.
 *
 * @module
 */

/**
 * Marks a code path as unimplemented. Always throws.
 */
export const todo = (): never => { throw 'not implemented' }

/**
 * Throws `msg` (default `'assertion failed'`) if `v` is `false`.
 *
 * Narrows `v` to `true` via `asserts v`, so callers can rely on the
 * condition holding for the rest of the enclosing scope.
 */
export const assert: (v: boolean, msg?: unknown) => asserts v = (v, msg = 'assertion failed') => {
    if (!v) throw msg
}

/**
 * Asserts that `a` and `b` are `===`, throwing `x` (the `[a, b]` pair, plus
 * an optional third element used as an extra message) if they differ.
 */
export const assertEq = <T>(...x: readonly[T, T, unknown?]): void => {
    const [a, b] = x
    assert(a === b, x)
}

/**
 * Compile-time-only check: a type resolves only if it is exactly `true`.
 * Used to assert type-level properties without any runtime cost, e.g.
 * `type _ = Assert<Equal<A, B>>`.
 */
export type Assert<T extends true> = T

/**
 * Asserts that `a` is neither `null` nor `undefined` and returns it,
 * narrowed to `T`.
 *
 * Use this to chain directly off a call that may return a nullish value,
 * e.g. `const r = assertNotNullish(f(x))`. For a variable that already
 * exists, prefer `assert(a !== null && a !== undefined)` instead.
 */
export const assertNotNullish = <T>(a: T|null|undefined, msg?: unknown): T => {
    assert(a !== null && a !== undefined, msg)
    return a
}
