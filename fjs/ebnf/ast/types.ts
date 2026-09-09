/**
 * Type-level API of the EBNF AST: `Ast<R>` is the type of what matching the
 * rule `R` produces, one row per form of the rule union in `../types.ts`.
 *
 * The end of input has no source element and so no leaf: its node is empty,
 * as an empty string's is; a symbol is itself; a string is its symbols; a
 * tuple maps its elements; a
 * variant is the branch taken, tagged by its key, and an empty one, which
 * nothing can match, is `never`; a `const` thunk is its payload; a set is
 * one symbol; and a repeat is a `BoundedArray` of its item, so every bound
 * shape is one flat array with a different `.length`.
 *
 * @module
 */

import type { Assert } from "../../asserts/types.ts"
import type { BoundedArray } from "../../types/array/types.ts"
import type { Equal } from "../../types/ts/types.ts"
import type { Const, Rule, Tuple, Variant, Set, Repeat } from "../types.ts"

type _AnyAst =
    | number
    | readonly _AnyAst[]
    | readonly [string, _AnyAst]

export type Ast<R extends Rule> =
    Equal<R, Rule> extends true ? _AnyAst :
    // EOF: a consumed end of input has no source element, so it contributes
    // no leaf — the node is empty, as an empty string's is.
    R extends null ? readonly[] :
    // number
    R extends number ? R :
    // string
    R extends '' ? readonly[] :
    R extends string ? readonly number[] :
    // Tuple
    R extends Tuple ? _TupleAst<R> :
    // Variant
    R extends Variant ? _VariantAst<R> :
    // Const
    R extends Const<infer D> ? Ast<D> :
    // Set
    R extends () => readonly['set'] ? never :
    R extends Set ? number :
    // Repeat
    R extends Repeat<infer Min, infer Max, infer D> ? _RepeatAst<Min, Max, D>:
    //
    never

type _Any = Assert<Equal<Ast<Rule>, _AnyAst>>

type _Number = Assert<Equal<Ast<number>, number>>
type _Number0 = Assert<Equal<Ast<42>, 42>>
type _Number1 = Assert<Equal<Ast<42|-1>, -1|42>>

type _Eof = Assert<Equal<Ast<null>, readonly[]>>
// `document = [value, eof]`: the tuple keeps its arity, the EOF slot is empty.
type _Eof0 = Assert<Equal<Ast<readonly[42, null]>, readonly[42, readonly[]]>>
// An optional EOF: zero rounds, or one round holding the empty node.
type _Eof1 = Assert<Equal<Ast<Repeat<0, 1, null>>, readonly[] | readonly[readonly[]]>>

// A narrower rule has a narrower AST: `A extends B` implies `Ast<A> extends
// Ast<B>`. EOF being `null` rather than `-1` is what keeps `number` inside
// the law — a rule typed `number` is never the end of input.
type _Mono<A extends B, B extends Rule> = Ast<A> extends Ast<B> ? true : false
type _Mono0 = Assert<_Mono<null, Rule>>
type _Mono1 = Assert<_Mono<42, number>>
type _Mono2 = Assert<_Mono<-1, number>>
type _Mono3 = Assert<_Mono<readonly[42, null], Tuple>>
type _Mono4 = Assert<_Mono<{ readonly end: null }, Variant>>
type _Mono5 = Assert<_Mono<number, Rule>>

type _String = Assert<Equal<Ast<string>, readonly number[]>>
type _String0 = Assert<Equal<Ast<'hello'>, readonly number[]>>
type _String1 = Assert<Equal<Ast<''>, readonly[]>>

type _TupleAst<R extends Tuple> = { readonly[K in keyof R]: Ast<R[K]> }

type _Tuple = Assert<Equal<Ast<[12, -1]>, readonly[12, -1]>>
type _Tuple0 = Assert<Equal<Ast<[]>, readonly[]>>
type _Tuple1 = Assert<Equal<Ast<[12, string]>, readonly[12, readonly number[]]>>

type _PropertyName<V> =
    V extends string ? V :
    V extends number ? `${V}` :
    never

type _VariantAst<R extends Variant> =
    string extends keyof R ? readonly[string, Ast<R[string]>] :
    {
        readonly[K in keyof R]: readonly[
            _PropertyName<K>,
            Ast<R[K]>
        ]
    }[keyof R]

type _Variant = Assert<Equal<Ast<
    { readonly a: 12, readonly b: 'hello' }>,
    readonly['a', 12] | readonly['b', readonly number[]]>>
type _Variant0 = Assert<Equal<Ast<{}>, never>>
type _Variant1 = Assert<Equal<Ast<Variant>, readonly[string, Ast<Rule>]>>
type _Variant2 = Assert<Equal<Ast<{readonly 0:13}>, readonly['0', 13]>>
type _Variant3 = Assert<Equal<Ast<Const<Variant>>, readonly[string, Ast<Rule>]>>
type _Variant4 = Assert<Equal<Ast<{readonly[k in string]:42}>, readonly[string, 42]>>

type _Const = Assert<Equal<Ast<Const<42>>, 42>>
type _Const0 = Assert<Equal<Ast<() => ['const', 42]>, 42>>
type _Const1 = Assert<Equal<Ast<() => ['const', 'a']>, readonly number[]>>

type _Set = Assert<Equal<Ast<Set>, number>>
type _Set0 = Assert<Equal<Ast<() => ['set']>, never>>
type _Set1 = Assert<Equal<Ast<() => ['set', number]>, number>>
type _Set2 = Assert<Equal<Ast<() => ['set', number, -1]>, number>>

type _RepeatAst<Min extends number, Max extends number, D extends Rule> =
    BoundedArray<Min, Max, Ast<D>>

type _Repeat = Assert<Equal<Ast<Repeat<0, 1, 43>>, readonly[] | readonly[43]>>
type _Repeat0 = Assert<Equal<Ast<Repeat<0, 0, 43>>, readonly[]>>
type _Repeat1 = Assert<Equal<Ast<Repeat<0, number, 43>>, readonly 43[]>>
type _Repeat2 = Assert<Equal<
    Ast<Repeat<2, number, 43>>,
    readonly[43, 43, ...readonly 43[]]>>
