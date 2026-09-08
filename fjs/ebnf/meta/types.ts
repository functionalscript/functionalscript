
/**
 * `../ast/types.ts` with a metadata channel: `Ast<MI, MO, R>` is the type of
 * what matching the rule `R` produces when every input symbol carries `MI`
 * and a mapping may replace a subtree with a symbol carrying `MO`. One row
 * per form of the rule union in `../types.ts`, as there.
 *
 * A leaf is a `Meta<MI, S>` — the symbol and what the grammar ignored about
 * it — rather than the bare number, and `Meta<MO>` is admitted at every row,
 * since any subtree may be the result of a mapping. Everything else is the
 * shape `Ast<R>` has: the end of input has no source element and so no leaf,
 * its node empty, as an empty string's is; a string is its symbols; a tuple
 * maps its elements; a variant is the branch taken, tagged by its key, and an
 * empty one, which nothing can match, is `never`; a `const` thunk is its
 * payload; a set is one symbol; and a repeat is a `BoundedArray` of its item,
 * so every bound shape is one flat array with a different `.length`.
 *
 * The design this is the first piece of:
 * [meta-ast-mapping](../todo/meta-ast-mapping.md).
 *
 * @module
 */

import type { Assert } from "../../asserts/types.ts"
import type { BoundedArray } from "../../types/array/types.ts"
import type { Equal } from "../../types/ts/types.ts"
import type { Const, Rule, Tuple, Variant, Set, Repeat, Option } from "../types.ts"

export type Symbol = number

export type Meta<M, S extends Symbol = Symbol> = { readonly symbol: S, readonly meta: M }

type _AnyAst<MO, MI> =
    | Meta<MO>
    | Meta<MI>
    | readonly _AnyAst<MO, MI>[]
    | readonly [string, _AnyAst<MO, MI>]

export type Ast<MI, MO, R extends Rule> =
    | (Equal<R, Rule> extends true ? _AnyAst<MO, MI> :
        // EOF: a consumed end of input has no source element, so it contributes
        // no leaf — the node is empty, as an empty string's is.
        R extends null ? Meta<MO> | readonly[] :
        // number
        R extends number ? Meta<MO> | Meta<MI, R> :
        // string
        R extends '' ? Meta<MO> | readonly[] :
        R extends string ? Meta<MO> | readonly Meta<MI>[] :
        // Tuple
        R extends Tuple ? _TupleAst<MI, MO, R> :
        // Variant
        R extends Variant ? _VariantAst<MI, MO, R> :
        // Const
        R extends Const<infer D> ? Ast<MI, MO, D> :
        // Set
        R extends () => readonly['set'] ? never :
        R extends Set ? Meta<MO> | Meta<MI> :
        // Repeat
        R extends Repeat<infer Min, infer Max, infer D> ? _RepeatAst<MI, MO, Min, Max, D>:
        //
        never)

type _MI = 'mi'
type _MO = 'mo'

type _Any = Assert<Equal<Ast<_MI, _MO, Rule>, Meta<_MO> | _AnyAst<_MI, _MO>>>

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

type _TupleAst<MI, MO, R extends Tuple> = Meta<MO> | { readonly[K in keyof R]: Ast<MI, MO, R[K]> }

type _Tuple = Assert<Equal<Ast<_MI, _MO, [12, -1]>, Meta<_MO> | readonly[Ast<_MI, _MO, 12>, Ast<_MI, _MO, -1>]>>
type _Tuple0 = Assert<Equal<Ast<_MI, _MO, []>, Meta<_MO> | readonly[]>>
type _Tuple1 = Assert<Equal<Ast<_MI, _MO, [12, string]>, Meta<_MO> | readonly[Ast<_MI, _MO, 12>, Ast<_MI, _MO, string>]>>

type _PropertyName<V> =
    V extends string ? V :
    V extends number ? `${V}` :
    never

type _VariantAst<MI, MO, R extends Variant> =
    string extends keyof R ? Meta<MO> | readonly[string, Ast<MI, MO, R[string]>] :
    Meta<MO> | {
        readonly[K in keyof R]: readonly[
            _PropertyName<K>,
            Ast<MI, MO, R[K]>
        ]
    }[keyof R]

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
type _Set0 = Assert<Equal<Ast<_MI, _MO, () => ['set']>, never>>
type _Set1 = Assert<Equal<Ast<_MI, _MO, () => ['set', number]>, Meta<_MO> | Meta<_MI>>>
type _Set2 = Assert<Equal<Ast<_MI, _MO, () => ['set', number, -1]>, Meta<_MO> | Meta<_MI>>>

type _RepeatAst<MI, MO, Min extends number, Max extends number, D extends Rule> =
    Meta<MO> | BoundedArray<Min, Max, Ast<MI, MO, D>>

// The metadata pair is threaded by parameter, not read from the `_MI`/`_MO`
// the rows above are written against: a nested position carries whatever pair
// the caller passed. The assertions above compare `Ast` against `Ast`, so they
// hold either way; this one spells the expected side out.
type _MI2 = 'mi2'
type _MO2 = 'mo2'
type _Threaded = Assert<Equal<
    Ast<_MI2, _MO2, [12, { readonly a: 13 }, Option<14>]>,
    Meta<_MO2> | readonly[
        Meta<_MO2> | Meta<_MI2, 12>,
        Meta<_MO2> | readonly['a', Meta<_MO2> | Meta<_MI2, 13>],
        Meta<_MO2> | readonly[] | readonly[Meta<_MO2> | Meta<_MI2, 14>]]>>

type _Repeat = Assert<Equal<Ast<_MI, _MO, Option<43>>, Meta<_MO> | readonly[] | readonly[Ast<_MI, _MO, 43>]>>
type _Repeat0 = Assert<Equal<Ast<_MI, _MO, Repeat<0, 0, 43>>, Meta<_MO> | readonly[]>>
type _Repeat1 = Assert<Equal<Ast<_MI, _MO, Repeat<0, number, 43>>, Meta<_MO> | readonly Ast<_MI, _MO, 43>[]>>
type _Repeat2 = Assert<Equal<
    Ast<_MI, _MO, Repeat<2, number, 43>>,
    Meta<_MO> | readonly[Ast<_MI, _MO, 43>, Ast<_MI, _MO, 43>, ...readonly Ast<_MI, _MO, 43>[]]>>
