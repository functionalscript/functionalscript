/**
 * Types for plain-object helpers: the `OptionalMap`/`RequiredMap`/`StringMap`
 * record shapes and `Entry<T>`, and the `OneKey`/`SingleProperty`/`NotUnion`
 * utility types.
 *
 * @module
 */

/** A record over the keys of `K`, each value possibly missing at runtime. */
export type OptionalMap<K extends string, T> = { readonly[k in K]?: T }

/**
 * A record over the keys of `K`, each value required.
 *
 * `K` has to be a finite union of string literals: `RequiredMap<string, T>` is
 * `never`, because no object can carry every string as a key. Use `StringMap<T>`
 * for an open key set — its values are optional, which is what such a key set
 * means at runtime.
 *
 * There is no known way to ask TypeScript whether `K` is finite, so the guard
 * approximates it with `string extends K`, which holds exactly when `K` is
 * `string`. Other infinite key sets are not caught: a template literal such as
 * `x-${string}` yields a template index signature instead of `never`, and its
 * reads are typed `T` while the runtime value is `undefined`. Keep `K` a union
 * of string literals.
 */
export type RequiredMap<K extends string, T> =
    string extends K
    ? never
    : { readonly[k in K]: T }

/** A record with an open key set. Every value can be missing at runtime. */
export type StringMap<T> = OptionalMap<string, T>

export type Entry<T> = readonly[string, T]

/**
 * A set of objects with a single key.
 *
 * See also
 * https://stackoverflow.com/questions/57571664/typescript-type-for-an-object-with-only-one-key-no-union-type-allowed-as-a-key
 */
export type OneKey<K extends string, V> = {
    [P in K]: (RequiredMap<P, V> & OptionalMap<Exclude<K, P>, never>) extends infer O
        ? { [Q in keyof O]: O[Q] }
        : never
}[K];

/**
 * https://stackoverflow.com/questions/61112584/typing-a-single-record-entry
 */
export type NotUnion<T, U = T> =
  T extends unknown ?
    [U] extends [T] ? T
    : never
  : never;

export type SingleProperty<T extends StringMap<never>> =
  keyof T extends NotUnion<keyof T> ? T
  : never;
