/**
 * Types for the serializable RTTI data form.
 *
 * A schema in data form denotes a set of values. The representation
 * partitions that set into six disjoint *kinds* — unit values (`null`,
 * `undefined`, `false`, `true`), numbers, strings, bigints, arrays and
 * objects — so that union, equality and subset reduce to kind-wise set
 * operations. See `./README.md` for the design rationale.
 *
 * @module
 */

import type { StringMap } from '../../object/types.ts'

/**
 * A set of values of one kind: `true` is the whole kind, an array lists its
 * members (literals or patterns), canonically sorted and deduplicated. An
 * empty kind is an absent property of {@link UnionSet}, never an empty array.
 */
export type KindSet<T> = true | readonly T[]

/**
 * A set of arrays: a tuple with an optional rest.
 *
 * - `prefix` constrains, per leading position, the value *read* at that
 *   position — a position past the array's end reads as `undefined`, so a
 *   position is required exactly when its set excludes `undefined`. This is
 *   the array half of the rule {@link ObjectSet} states for keys.
 * - `rest` present: the value at every position past the prefix belongs to
 *   `rest`.
 * - `rest` absent: there is nothing past the prefix.
 *
 * A bare tuple schema is `{ prefix }` alone — the exact-length set, since
 * tuples are closed (see "Structs and tuples are closed" in `../README.md`) —
 * an `open` one is `{ prefix, rest: unknown }`, and a uniform array schema is
 * `{ prefix: [], rest }`.
 * All are points of the same kind, so a longer tuple pattern included in a
 * shorter one is a plain pattern inclusion, the array counterpart of a wider
 * struct included in a narrower one.
 */
export type ArraySet = {
    readonly prefix: readonly Node[]
    readonly rest?: Node
}

/**
 * A set of objects: per-key value sets with an optional rest.
 *
 * - `props` constrains, per declared key, the value *read* at that key — an
 *   absent property reads as `undefined`, so a key is required exactly when
 *   its set excludes `undefined`. Keys are canonically sorted, and a key
 *   whose set is the whole value domain is omitted.
 * - `rest` present: the value at every other *present* key belongs to `rest`.
 * - `rest` absent: other keys are unconstrained.
 *
 * A struct schema is `{ props }`; a uniform record schema is
 * `{ props: {}, rest }`.
 */
export type ObjectSet = {
    readonly props: StringMap<Node>
    readonly rest?: Node
}

/**
 * A set of values as a disjoint union over the six kinds. An absent
 * component is the empty set of that kind, so `{}` is `never` and a union
 * with every component at its maximum (see `unknown` in `./module.f.mjs`)
 * is `unknown`.
 *
 * `unit` is a bitset over the four singleton values; bit `1 << i` stands for
 * `unitList[i]` from `./module.f.mjs` (`['null', 'undefined', 'false',
 * 'true']`), so `or(true, false)` collapses to the two boolean bits with no
 * special-case rule.
 */
export type UnionSet = {
    readonly unit?: number
    readonly number?: KindSet<number>
    readonly string?: KindSet<string>
    readonly bigint?: KindSet<bigint>
    readonly array?: KindSet<ArraySet>
    readonly object?: KindSet<ObjectSet>
}

/**
 * A nested type position: an inline {@link UnionSet}, or the name of a rule
 * in the enclosing {@link RuleSet}. Only recursive definitions are named;
 * everything else is inlined, so non-recursive schemas are pure trees.
 */
export type Node = UnionSet | string

/** Named recursive definitions, referenced by {@link Node} strings. */
export type RuleSet = StringMap<UnionSet>

/**
 * A complete serializable schema: the named recursive definitions plus the
 * entry node. Produced by `toData` in `./module.f.mjs`.
 */
export type Data = readonly [RuleSet, Node]
