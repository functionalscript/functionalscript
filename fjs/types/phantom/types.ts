/**
 * Phantom type — attaches a compile-time type annotation `T` to `S` with zero
 * runtime representation, analogous to Rust's `PhantomData<T>`.
 *
 * The phantom field uses a unique symbol key so it is excluded from string index
 * signatures (`{ readonly [K in string]: ... }`), making `Phantom<S, T>` valid
 * for any `S` regardless of its index signature constraints.
 *
 * @module
 */

declare const phantomKey: unique symbol

export type { phantomKey }

/**
 * Intersects `S` with a phantom field carrying type `T`.
 *
 * The field is optional (`?`) so it never needs to be present at runtime.
 * Use `phantomKey` to read the phantom type back out via a conditional type:
 * `S extends Phantom<unknown, infer T> ? T : never`.
 *
 * **`T` is an unchecked annotation, not a derivation** — nothing stops it from
 * being wrong, and once something reads it back (e.g. `Ts<>` in
 * `fjs/types/rtti/ts/types.ts`, which short-circuits to `T` instead of
 * structurally recursing), a wrong `T` is trusted silently. Guard every
 * `Phantom<typeof rawThunk, T>` with two asserts: one against the
 * un-annotated `rawThunk` (forces the real structural check, catching a
 * wrong `T`) and one against the phantom-wrapped export (catches the export
 * and the raw thunk drifting apart), using `Check` from
 * `fjs/types/rtti/ts/types.ts`. See `fjs/edag/module.f.mjs`
 * (`propertyAccessor`/`propertyCall`/`binaryOp`) for the pattern:
 *
 * ```ts
 * const rawThunk = () => [...] as const
 * export const thunk: Phantom<typeof rawThunk, MyType> = rawThunk
 * type _Check0 = Assert<Check<MyType, typeof rawThunk>>
 * type _Check1 = Assert<Check<MyType, typeof thunk>>
 * ```
 */
export type Phantom<S, T> = S & { readonly [phantomKey]?: T }
