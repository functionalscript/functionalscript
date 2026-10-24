/**
 * Type-level API of the JSON grammar: the shapes its helpers build, spelled
 * from their arguments so that `Ast` in `../../ast/types.ts` sees them.
 *
 * `Container<Item>` is what `cj` builds and `Value<P, V>` what `createValue`
 * builds, each written from the rule types it was given; {@link JsonValue}
 * is the grammar's own value, which names itself and so is spelled here,
 * as a named type that a `const` binding may be annotated with. A rule
 * built by a helper is then as precise as one written out, and a mapping of
 * `value` receives its seven branches rather than any tagged node at all.
 *
 * @module
 */

import type { JoinNode, Unmapped } from '../../ast/types.ts'
import type { Join, Rule } from '../../types.ts'
import type { number, string, ws } from './module.f.mjs'

/**
 * A comma-separated list of `Item`s inside a pair of delimiters, as `cj`
 * builds it: each item followed by whitespace, the list `join`ed by a comma
 * and whitespace, and optional as a whole so that an empty container is one
 * too. The delimiters are one symbol each and arrive as a string, so they
 * are spelled `string` here. `items` in `./module.f.mjs` reads the items
 * back out of the node this shape produces.
 */
export type Container<Item extends Rule> = readonly [
    open: string,
    ws: typeof ws,
    items: Join<readonly [',', typeof ws], readonly [Item, typeof ws]>,
    close: string,
]

/**
 * The node a {@link Container} produces, over the item node `T`, typed by
 * shape as `JoinNode` is: the list between the delimiters, each item beside
 * its whitespace. `items` in `./module.f.mjs` reads the items back out of
 * it.
 */
export type ContainerNode<T> = readonly [
    open: unknown,
    ws: unknown,
    items: Unmapped<JoinNode<Unmapped<readonly [T, unknown]>>>,
    close: unknown,
]

/** One `property : value` pair of an object, with whitespace around the colon. */
export type Entry<P extends Rule, V extends Rule> =
    readonly [P, typeof ws, ':', typeof ws, V]

/**
 * The node an {@link Entry} produces, over the key node `K` and the value
 * node `V`: the key, the colon with whitespace around it, and the value.
 * `entry` in `./module.f.mjs` reads the pair back out of it.
 */
export type EntryNode<K, V> = Unmapped<readonly [
    key: K,
    ws: unknown,
    colon: unknown,
    ws: unknown,
    value: V,
]>

/**
 * The node a mapping of a value built by `createValue` receives, over the
 * item node `T` of an array, the entry node `E` of an object, and the string
 * and number nodes `S` and `N`: one row per branch, tagged by its key. A
 * grammar that adds branches has a node with more rows than these.
 */
export type ValueNode<T, E, S, N> =
    | readonly ['array', Unmapped<ContainerNode<T>>]
    | readonly ['object', Unmapped<ContainerNode<E>>]
    | readonly ['string', S]
    | readonly ['number', N]
    | readonly ['true' | 'false' | 'null', unknown]

/**
 * A handler per branch of a {@link ValueNode}, each answering `R`: a
 * container's receives its items, and the three keywords' one handler
 * receives the constant each spells. `valueCases` in `./module.f.mjs`
 * dispatches over it.
 */
export type ValueCases<T, E, S, N, R> = {
    readonly array: (items: readonly T[]) => R
    readonly object: (entries: readonly E[]) => R
    readonly string: (node: S) => R
    readonly number: (node: N) => R
    readonly word: (word: boolean | null) => R
}

/**
 * The seven alternatives a value has, as `createValue` builds them from a
 * property rule `P` and a value rule `V`.
 */
export type Value<P extends Rule, V extends Rule> = {
    readonly array: Container<V>
    readonly object: Container<Entry<P, V>>
    readonly string: typeof string
    readonly number: typeof number
    readonly true: 'true'
    readonly false: 'false'
    readonly null: 'null'
}

/**
 * The JSON grammar's value: a `const` thunk whose payload is {@link Value}
 * over `string` and the thunk itself. The recursion is spelled through the
 * thunk's function type, which is what lets a type alias name itself.
 */
export type JsonValue =
    () => readonly ['const', Value<typeof string, JsonValue>]
