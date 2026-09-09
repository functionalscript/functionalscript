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

import type { Option, RepeatFrom, Rule } from '../../types.ts'
import type { number, string, ws } from './module.f.mjs'

/**
 * A comma-separated list of `Item`s inside a pair of delimiters, as `cj`
 * builds it: each item followed by whitespace, the whole list optional so
 * that an empty container is one too. The delimiters are one symbol each
 * and arrive as a string, so they are spelled `string` here.
 */
export type Container<Item extends Rule> = readonly [
    open: string,
    ws: typeof ws,
    items: Option<readonly [
        readonly [Item, typeof ws],
        RepeatFrom<0, readonly [readonly [',', typeof ws], readonly [Item, typeof ws]]>]>,
    close: string,
]

/** One `property : value` pair of an object, with whitespace around the colon. */
export type Entry<P extends Rule, V extends Rule> =
    readonly [P, typeof ws, ':', typeof ws, V]

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
