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

export type Meta<M, S extends number = number> = { readonly symbol: S, readonly meta: M }

// The widened row, and so the target of every monotonicity check: a subtree
// under a rule known only as `Rule`. It admits `Meta<MO>` at every depth, not
// just at the top, because a mapping may sit anywhere — a tuple holding one
// mapped child is a tuple whose rule is still unknown.
type _AnyAst<I, O> =
    | Meta<I> // input symbols
    | Meta<O> // output symbols
    | readonly _AnyAst<I, O>[] // tuples and repeats
    | readonly [string, _AnyAst<I, O>] // variants

export type Ast<I, O, R extends Rule> =
    | Meta<O>
    | (Equal<R, Rule> extends true ? _AnyAst<I, O> :
        // EOF: a consumed end of input has no source element, so it contributes
        // no leaf — the node is empty, as an empty string's is.
        R extends null ? readonly[] :
        // number
        R extends number ? Meta<I, R> :
        // string
        R extends '' ? readonly[] :
        R extends string ? readonly Ast<I, O, number>[] :
        // Tuple
        R extends Tuple ? _TupleAst<I, O, R> :
        // Variant
        R extends Variant ? _VariantAst<I, O, R> :
        // Const
        R extends Const<infer D> ? Ast<I, O, D> :
        // Set
        R extends () => readonly['set'] ? never :
        R extends Set ? Meta<I> :
        // Repeat
        R extends Repeat<infer Min, infer Max, infer D> ? _RepeatAst<I, O, Min, Max, D>:
        //
        never)

type _MI = 'mi'
type _MO = 'mo'

type _Any = Assert<Equal<Ast<_MI, _MO, Rule>, _AnyAst<_MI, _MO>>>

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
type _Mono6 = Assert<_Mono<Tuple, Rule>>
type _Mono7 = Assert<_Mono<Variant, Rule>>
type _Mono8 = Assert<_Mono<Set, Rule>>

// The law at the widened boundary, where the target is `_AnyAst` rather than a
// row: a mapped subtree is admitted at depth, under a tuple and under a
// variant's tag, and not only as the whole tree.
type _Holds<A, B> = A extends B ? true : false
type _Mapped = Assert<_Holds<readonly[Meta<_MO>], Ast<_MI, _MO, Rule>>>
type _Mapped0 = Assert<_Holds<readonly['a', Meta<_MO>], Ast<_MI, _MO, Rule>>>
type _Mapped1 = Assert<_Holds<readonly[readonly[Meta<_MO>]], Ast<_MI, _MO, Rule>>>
type _Mapped2 = Assert<_Holds<Ast<_MI, _MO, readonly[42, null]>, Ast<_MI, _MO, Rule>>>

type _String = Assert<Equal<Ast<_MI, _MO, string>, Meta<_MO> | readonly Ast<_MI, _MO, number>[]>>
type _String0 = Assert<Equal<Ast<_MI, _MO, 'hello'>, Meta<_MO> | readonly Ast<_MI, _MO, number>[]>>
type _String1 = Assert<Equal<Ast<_MI, _MO, ''>, Meta<_MO> | readonly[]>>
// `_String` and `_String0` compare `Ast` against `Ast`, so they hold whatever
// the element row says. These spell it out: a mapped code point stands where
// an unmapped one would, alone and beside one.
type _String2 = Assert<_Holds<readonly[Meta<_MO>], Ast<_MI, _MO, 'a'>>>
type _String3 = Assert<_Holds<readonly[Meta<_MI>, Meta<_MO>], Ast<_MI, _MO, 'ab'>>>

type _TupleAst<I, O, R extends Tuple> = { readonly[K in keyof R]: Ast<I, O, R[K]> }

type _Tuple = Assert<Equal<Ast<_MI, _MO, [12, -1]>, Meta<_MO> | readonly[Ast<_MI, _MO, 12>, Ast<_MI, _MO, -1>]>>
type _Tuple0 = Assert<Equal<Ast<_MI, _MO, []>, Meta<_MO> | readonly[]>>
type _Tuple1 = Assert<Equal<Ast<_MI, _MO, [12, string]>, Meta<_MO> | readonly[Ast<_MI, _MO, 12>, Ast<_MI, _MO, string>]>>

type _PropertyName<V> =
    V extends string ? V :
    V extends number ? `${V}` :
    never

type _VariantAst<I, O, R extends Variant> =
    string extends keyof R ? readonly[string, Ast<I, O, R[string]>] :
    {
        readonly[K in keyof R]: readonly[
            _PropertyName<K>,
            Ast<I, O, R[K]>
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
type _Set0 = Assert<Equal<Ast<_MI, _MO, () => ['set']>, Meta<_MO> | never>>
type _Set1 = Assert<Equal<Ast<_MI, _MO, () => ['set', number]>, Meta<_MO> | Meta<_MI>>>
type _Set2 = Assert<Equal<Ast<_MI, _MO, () => ['set', number, -1]>, Meta<_MO> | Meta<_MI>>>

type _RepeatAst<I, O, Min extends number, Max extends number, D extends Rule> =
    BoundedArray<Min, Max, Ast<I, O, D>>

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
