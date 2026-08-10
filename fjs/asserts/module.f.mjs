/**
 * Assertion helpers for runtime checks and compile-time type-level tests.
 *
 * @module
 */

/**
 * Marks a code path as unimplemented. Always throws.
 * @type {() => never}
 */
export const todo = () => { throw 'not implemented' }

/**
 * Throws `msg` (default `'assertion failed'`) if `v` is `false`.
 *
 * Narrows `v` to `true` via `asserts v`, so callers can rely on the
 * condition holding for the rest of the enclosing scope.
 *
 * @type {(v: boolean, msg?: unknown) => asserts v}
 */
export const assert = (v, msg = 'assertion failed') => {
    if (!v) throw msg
}

/**
 * Asserts that `a` and `b` are `===`, throwing `x` (the `[a, b]` pair, plus
 * an optional third element used as an extra message) if they differ.
 *
 * @type {<T>(...x: readonly[T, T, unknown?]) => void}
 */
export const assertEq = (...x) => {
    const [a, b] = x
    assert(a === b, x)
}

/**
 * Asserts that `a` is neither `null` nor `undefined` and returns it,
 * narrowed to `T`.
 *
 * Use this to chain directly off a call that may return a nullish value,
 * e.g. `const r = assertNotNullish(f(x))`. For a variable that already
 * exists, prefer `assert(a !== null && a !== undefined)` instead.
 *
 * @type {<T>(a: T|null|undefined, msg?: unknown) => T}
 */
export const assertNotNullish = (a, msg) => {
    assert(a !== null && a !== undefined, msg)
    return a
}
