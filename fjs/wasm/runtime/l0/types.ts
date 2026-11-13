/**
 * Type-level API for `fjs/wasm/runtime/l0/module.f.js`.
 *
 * @module
 */

/**
 * The tag `kind` answers: 0 `undefined`, 1 `null`, 2 boolean, 3 number,
 * 4 string, 5 bigint, 6 array, 7 object, 8 function. The tags are part of
 * the L0 ABI version.
 */
export type Kind = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

/** A value `asArray` answers. */
export type L0Array = readonly unknown[]

/** A value `asObject` answers. */
export type L0Object = { readonly [k in string]: unknown }

/** A value `asFunction` answers: callable with any arguments, as L0 `call` calls it. */
export type L0Function = (...args: readonly unknown[]) => unknown

/** A cast: the value itself, with its type known, or a throw where WASM traps. */
export type Cast<T> = (v: unknown) => T
