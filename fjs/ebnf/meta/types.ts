
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
import type { Const, Rule, Tuple, Variant, Set, Repeat, Option } from "../types.ts"

export type Meta<M, S extends number = number> = { readonly symbol: S, readonly meta: M }

type _AnyAst<MI> =
    | Meta<MI>
    | readonly _AnyAst<MI>[]
    | readonly [string, _AnyAst<MI>]

type Symbol<M> = Meta<M>

export type Ast<MI, MO, R extends Rule> =
    | Meta<MO>
    | (Equal<R, Rule> extends true ? _AnyAst<MI> :
        // EOF: a consumed end of input has no source element, so it contributes
        // no leaf — the node is empty, as an empty string's is.
        R extends null ? readonly[] :
        // number
        R extends number ? Meta<MI, R> :
        // string
        R extends '' ? readonly[] :
        R extends string ? readonly Meta<MI>[] :
        // Tuple
        R extends Tuple ? _TupleAst<R> :
        // Variant
        R extends Variant ? _VariantAst<_MI, _MO, R> :
        // Const
        R extends Const<infer D> ? Ast<MI, MO, D> :
        // Set
        R extends () => readonly['set'] ? never :
        R extends Set ? Meta<MI> :
        // Repeat
        R extends Repeat<infer Min, infer Max, infer D> ? _RepeatAst<Min, Max, D>:
        //
        never)

type _MI = 'mi'
type _MO = 'mo'

type _Any = Assert<Equal<Ast<_MI, _MO, Rule>, Meta<_MO> | _AnyAst<_MI>>>

type _Number = Assert<Equal<Ast<_MI, _MO, number>, Meta<_MO> | Meta<_MI, number>>>
type _Number0 = Assert<Equal<Ast<_MI, _MO, 42>, Meta<_MO> | Meta<_MI, 42>>>
type _Number1 = Assert<Equal<Ast<_MI, _MO, 42|-1>, Meta<_MO> | Meta<_MI, -1> | Meta<_MI, 42>>>

type _Eof = Assert<Equal<Ast<_MI, _MO, null>, Meta<_MO> | readonly[]>>
// `document = [value, eof]`: the tuple keeps its arity, the EOF slot is empty.
type _Eof0 = Assert<Equal<Ast<_MI, _MO, readonly[42, null]>, Meta<_MO> | readonly[Ast<_MI, _MO, 42>, Meta<_MO> |readonly[]]>>
// An optional EOF: zero rounds, or one round holding the empty node.
type _Eof1 = Assert<Equal<Ast<_MI, _MO, Option<null>>, Meta<_MO> | readonly[] | readonly[Ast<_MI, _MO, null>]>>

// A narrower rule has a narrower AST: `A extends B` implies `Ast<A> extends
// Ast<B>`. EOF being `null` rather than `-1` is what keeps `number` inside
// the law — a rule typed `number` is never the end of input.
type _Mono<A extends B, B extends Rule> = Ast<_MI, _MO, A> extends Ast<_MI, _MO, B> ? true : false
type _Mono0 = Assert<_Mono<null, Rule>>
type _Mono1 = Assert<_Mono<42, number>>
type _Mono2 = Assert<_Mono<-1, number>>
type _Mono3 = Assert<_Mono<readonly[42, null], Tuple>>
type _Mono4 = Assert<_Mono<{ readonly end: null }, Variant>>
type _Mono5 = Assert<_Mono<number, Rule>>

type _String = Assert<Equal<Ast<_MI, _MO, string>, Meta<_MO> | readonly Meta<_MI>[]>>
type _String0 = Assert<Equal<Ast<_MI, _MO, 'hello'>, Meta<_MO> | readonly Meta<_MI>[]>>
type _String1 = Assert<Equal<Ast<_MI, _MO, ''>, Meta<_MO> | readonly[]>>

type _TupleAst<R extends Tuple> = { readonly[K in keyof R]: Ast<_MI, _MO, R[K]> }

type _Tuple = Assert<Equal<Ast<_MI, _MO, [12, -1]>, Meta<_MO> | readonly[Ast<_MI, _MO, 12>, Ast<_MI, _MO, -1>]>>
type _Tuple0 = Assert<Equal<Ast<_MI, _MO, []>, Meta<_MO> | readonly[]>>
type _Tuple1 = Assert<Equal<Ast<_MI, _MO, [12, string]>, Meta<_MO> | readonly[Ast<_MI, _MO, 12>, Ast<_MI, _MO, string>]>>

type _PropertyName<V> =
    V extends string ? V :
    V extends number ? `${V}` :
    never

type _VariantAst<_MI, _MO, R extends Variant> =
    string extends keyof R ? readonly[string, Ast<_MI, _MO, R[string]>] :
    {
        readonly[K in keyof R]: readonly[
            _PropertyName<K>,
            Ast<_MI, _MO, R[K]>
        ]
    }[keyof R]

type X0 = Ast<_MI, _MO, { readonly a: 12, readonly b: 'hello' }>
type _Variant = Assert<Equal<Ast<_MI, _MO, { readonly a: 12, readonly b: 'hello' }>,
    Meta<_MO> | readonly['a', Ast<_MI, _MO, 12>] | readonly['b', Ast<_MI, _MO, 'hello'>]>>
type _Variant0 = Assert<Equal<Ast<_MI, _MO, {}>, Meta<_MO>>>
type _Variant1 = Assert<Equal<Ast<_MI, _MO, Variant>, Meta<_MO> | readonly[string, Ast<_MI, _MO, Rule>]>>
type _Variant2 = Assert<Equal<Ast<_MI, _MO, {readonly 0:13}>, Meta<_MO> | readonly['0', Ast<_MI, _MO, 13>]>>
type _Variant3 = Assert<Equal<Ast<_MI, _MO, Const<Variant>>, Meta<_MO> | readonly[string, Ast<_MI, _MO, Rule>]>>
type _Variant4 = Assert<Equal<Ast<_MI, _MO, {readonly[k in string]:42}>, Meta<_MO> | readonly[string, Meta<_MO>| Meta<_MI, 42>]>>

type _Const = Assert<Equal<Ast<_MI, _MO, Const<42>>, Ast<_MI, _MO, 42>>>
type _Const0 = Assert<Equal<Ast<_MI, _MO, () => ['const', 42]>, Ast<_MI, _MO, 42>>>
type _Const1 = Assert<Equal<Ast<_MI, _MO, () => ['const', 'a']>, Ast<_MI, _MO, 'a'>>>

type _Set = Assert<Equal<Ast<_MI, _MO, Set>, Meta<_MO> | Meta<_MI>>>
type _Set0 = Assert<Equal<Ast<_MI, _MO, () => ['set']>, Meta<_MO> | never>>
type _Set1 = Assert<Equal<Ast<_MI, _MO, () => ['set', number]>, Meta<_MO> | Meta<_MI>>>
type _Set2 = Assert<Equal<Ast<_MI, _MO, () => ['set', number, -1]>, Meta<_MO> | Meta<_MI>>>

type _RepeatAst<Min extends number, Max extends number, D extends Rule> =
    BoundedArray<Min, Max, Ast<_MI, _MO, D>>

type _Repeat = Assert<Equal<Ast<_MI, _MO, Option<43>>, Meta<_MO> | readonly[] | readonly[Ast<_MI, _MO, 43>]>>
type _Repeat0 = Assert<Equal<Ast<_MI, _MO, Repeat<0, 0, 43>>, Meta<_MO> | readonly[]>>
type _Repeat1 = Assert<Equal<Ast<_MI, _MO, Repeat<0, number, 43>>, Meta<_MO> | readonly Ast<_MI, _MO, 43>[]>>
type _Repeat2 = Assert<Equal<
    Ast<_MI, _MO, Repeat<2, number, 43>>,
    Meta<_MO> | readonly[Ast<_MI, _MO, 43>, Ast<_MI, _MO, 43>, ...readonly Ast<_MI, _MO, 43>[]]>>
