/**
 * Type-level API of the JSON reader: the numeric policy a codec supplies,
 * the tree that policy parses into, and the output alphabet the reader's
 * mappings return into — the input alphabet is `../../../ebnf/utf16/types.ts`.
 *
 * @module
 */

import type { Tree } from '../types.ts'
import type { Assert } from '../../../asserts/types.ts'
import type { Equal } from '../../../types/ts/types.ts'
import type { Result } from '../../../types/result/types.ts'
import type { Meta } from '../../../ebnf/ast/types.ts'
import type { Utf16 } from '../../../ebnf/utf16/types.ts'

/**
 * A numeric policy: how one codec materializes a JSON number into its own
 * numeric domain `P`.
 *
 * The policy is handed the number's exact lexeme, as the grammar admits it —
 * `-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?` — before any narrowing the
 * reader might otherwise have imposed. It may fail: a valid JSON number can
 * be outside the domain the codec offers (the extended codec has no
 * non-finite `number`), and that has to be an ordinary parse error, its
 * message the policy's, rather than an escaping runtime exception.
 */
export type NumberPolicy<P> = (lexeme: string) => Result<P, string>

/**
 * The tree a numeric policy `P` parses into: JSON's containers over `P` plus
 * the primitives every policy shares.
 */
export type ParseUnknown<P> = Tree<P | null | boolean | string>

/**
 * What the `string` rule's mapping returns: the string the rule spells,
 * every escape decoded.
 */
export type Text = { readonly id: 'text', readonly value: string }

/**
 * What a value's mapping returns: the JSON value, or, where the policy
 * refused a number under it, the policy's error in the value's place.
 */
export type Json<P> = { readonly id: 'json', readonly result: Result<ParseUnknown<P>, string> }

/** The output alphabet: what the mappings return. */
export type Out<P> = Text | Json<P>

/** Whether `T` is a union of two or more members. */
type _IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never

/** `true` where some member of `O` has an `id` that is not one literal: the widened `string`, or a union. */
type _NotSingleton<O extends { readonly id: string }> =
    O extends unknown ? (string extends O['id'] ? true : _IsUnion<O['id']> extends true ? true : never) : never

/** The ids an alphabet may be addressed by: its members' `id`s where every one is a single literal, `never` otherwise. */
export type _LiteralId<O extends { readonly id: string }> = [_NotSingleton<O>] extends [never] ? O['id'] : never

/** The member of the alphabet `O` that `Id` names — computed, never supplied. */
export type _Member<O, Id extends string> = Extract<O, { readonly id: Id }>

/**
 * The one field of `M` besides `id`, or `never` where `M` has none or more
 * than one — so a member `tagged` cannot build whole has no key to name.
 * With none, the `Exclude` is itself `never`, whichever branch is taken.
 */
export type _OnlyKey<M> = _IsUnion<Exclude<keyof M, 'id'>> extends true ? never : Exclude<keyof M, 'id'>

/** `true` for each member of `M` that could carry the id `Id` yet is not `T`: a collider the runtime tag test cannot tell from `T`. */
type _Collides<Id extends string, T, M extends { readonly id: string }> =
    M extends unknown ? (Id extends M['id'] ? ([M] extends [T] ? never : true) : never) : never

/** `unknown` where every member of `M` that could carry `Id` is `T` itself; `never` otherwise, so a node over `M` is refused. */
type _Admits<Id extends string, T, M extends { readonly id: string }> =
    [_Collides<Id, T, M>] extends [never] ? unknown : never

/**
 * A tagged output symbol: the member of the alphabet `O` that `Id` names,
 * which must carry exactly one field besides `id`, and that field's key
 * `K`. `symbol` builds `{ symbol: 0, meta: { id, [key]: payload } }` — the
 * whole member, by construction — and `at` reads the payload back from a
 * node over any alphabet `M` in which nothing but that member can carry
 * `Id`, asserting `meta.id === id`.
 */
export type Tagged<O extends { readonly id: string }, Id extends _LiteralId<O>, K extends _OnlyKey<_Member<O, Id>>> = {
    readonly symbol: (payload: _Member<O, Id>[K]) => Meta<_Member<O, Id>>
    readonly at: <M extends { readonly id: string } = never>(node: (Meta<M> | readonly unknown[]) & _Admits<Id, _Member<O, Id>, M>) => _Member<O, Id>[K]
}

// What `Tagged` takes and refuses. Each pin was checked by breaking the
// mechanism it names.

// An alphabet whose ids are single literals addresses each member by its
// `id`, and a single-payload member names its one field.
type _JsonIds = Assert<Equal<_LiteralId<Out<number>>, 'text' | 'json'>>
type _TextMember = Assert<Equal<_Member<Out<number>, 'text'>, Text>>
type _TextKey = Assert<Equal<_OnlyKey<Text>, 'value'>>

// An alphabet with a widened or a union `id` addresses nothing: the tag
// test could not tell a node of that member from one of the literal one.
type _WidenedId = Assert<Equal<_LiteralId<{ readonly id: 'foo', readonly value: string } | { readonly id: string, readonly value: number }>, never>>
type _UnionId = Assert<Equal<_LiteralId<{ readonly id: 'foo', readonly value: string } | { readonly id: 'foo' | 'bar', readonly value: number }>, never>>

// A member with no field besides `id`, or with two, has no key to name.
type _NoField = Assert<Equal<_OnlyKey<{ readonly id: 'unit' }>, never>>
type _TwoFields = Assert<Equal<_OnlyKey<{ readonly id: 'pair', readonly left: number, readonly right: string }>, never>>

// `at` admits a node over an alphabet in which nothing but the member, or
// a subtype of it, can carry its `id`, and refuses one with a collider: a
// literal, a widened or a union `id` over another payload.
type _AdmitsOwn = Assert<Equal<_Admits<'text', Text, Utf16 | Out<number>>, unknown>>
type _AdmitsSubtype = Assert<Equal<_Admits<'text', Text, Utf16 | { readonly id: 'text', readonly value: 'a' }>, unknown>>
type _RefusesLiteral = Assert<Equal<_Admits<'text', Text, Utf16 | Text | { readonly id: 'text', readonly value: number }>, never>>
type _RefusesWidened = Assert<Equal<_Admits<'text', Text, Utf16 | Text | { readonly id: string, readonly value: number }>, never>>
type _RefusesUnion = Assert<Equal<_Admits<'text', Text, Utf16 | Text | { readonly id: 'text' | 'x', readonly value: number }>, never>>
