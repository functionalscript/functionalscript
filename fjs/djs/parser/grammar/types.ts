/**
 * Type-level API of the djs module grammar: the shapes its helpers build
 * and the value, which names itself and so is spelled here, as `JsonValue`
 * is in `fjs/ebnf/lib/json/types.ts` — a named type a `const` binding may
 * be annotated with.
 *
 * @module
 */

import type { Option, Rule } from '../../../ebnf/types.ts'
import type { identifier, key, primitive, trivia } from './module.f.mjs'

/**
 * A comma-separated list of `Item`s, at least one, a trailing comma
 * allowed: an item and its trivia, then optionally a comma, its trivia, and
 * the rest of the list — or nothing after the comma, which is the trailing
 * one. Right-recursive, so that one symbol of lookahead decides whether a
 * comma is followed by an item or by the closing bracket.
 */
export type Items<Item extends Rule> = () => readonly ['const', readonly [
    Item,
    typeof trivia,
    Option<readonly [number, typeof trivia, Option<Items<Item>>]>,
]]

/** An opening symbol, trivia, an optional list, and the closing symbol. */
export type Container<Item extends Rule> = readonly [number, typeof trivia, Option<Items<Item>>, number]

/** A key, trivia, `:`, trivia, and a value. */
export type Member = readonly [typeof key, typeof trivia, number, typeof trivia, Value]

/**
 * A value: a primitive token, a reference, an array of values, or an
 * object of members — a `const` thunk whose payload names the thunk, which
 * is what lets a type alias name itself.
 */
export type Value = () => readonly ['const', {
    readonly primitive: typeof primitive
    readonly ref: typeof identifier
    readonly array: Container<Value>
    readonly object: Container<Member>
}]
