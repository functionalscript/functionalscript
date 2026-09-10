/**
 * Type-level API of the djs module grammar: the alphabet it is written
 * over, the shapes its helpers build, and the value, which names itself
 * and so is spelled here, as `JsonValue` is in
 * `fjs/ebnf/lib/json/types.ts` — a named type a `const` binding may be
 * annotated with.
 *
 * @module
 */

import type { Option, Rule } from '../../../ebnf/types.ts'
import type { DjsToken } from '../../tokenizer/types.ts'
import type { identifier, key, primitive, trivia } from './module.f.mjs'

/**
 * The words that frame a module, which the grammar has to tell apart from an
 * ordinary identifier.
 *
 * The tokenizer emits all five as `{ kind: 'id' }` with the word in `value`, so
 * a parser layer keyed on `kind` alone would give them the same symbol as any
 * other identifier — and a grammar over that alphabet could not distinguish
 * `export default` from two arbitrary names. They therefore get terminals of
 * their own, which is what a registered alphabet allows: a name's symbol comes
 * from its position in the list, so a name has no length limit.
 */
export type _FramingKeyword = 'import' | 'const' | 'export' | 'default' | 'from'

/**
 * A token name the grammar can name as a terminal: every `DjsToken` kind
 * except `eof`, plus the framing keywords.
 *
 * `eof` is excluded because the backend synthesizes its own logical
 * end-of-input; the tokenizer's physical `eof` token is split off the stream
 * before any name is mapped, so it never reaches this alphabet.
 *
 * The kinds are derived from `DjsToken` rather than listed, so a token kind
 * added there cannot silently go unrepresented at the parser layer.
 */
export type _OrdinaryTokenName = Exclude<DjsToken['kind'], 'eof'> | _FramingKeyword

/**
 * A comma-separated list of `Item`s, at least one, a trailing comma
 * allowed: an item and its trivia, then optionally a comma, its trivia, and
 * the rest of the list — or nothing after the comma, which is the trailing
 * one. Right-recursive, so that one symbol of lookahead decides whether a
 * comma is followed by an item or by the closing bracket.
 *
 * The rest of the list is the list itself, which the type leaves as
 * `Rule`: a type that named itself there would nest a list inside every
 * list a value holds, which is more than `tsc` unrolls (TS2589), and a
 * reader takes the rest from the list's own mapping — one symbol by then —
 * rather than from the type.
 */
export type Items<Item extends Rule> = () => readonly ['const', readonly [
    Item,
    typeof trivia,
    Option<readonly [number, typeof trivia, Option<Rule>]>,
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
