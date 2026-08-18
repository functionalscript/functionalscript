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
 */
export type Phantom<S, T> = S & { readonly [phantomKey]?: T }
