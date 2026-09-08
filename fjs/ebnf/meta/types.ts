/**
 * `../ast/types.ts` with a metadata channel: `Ast<I, O, R>` is the type of
 * what matching the rule `R` produces when every input symbol carries `I`
 * and a mapping may replace a subtree with a symbol carrying `O`. One row
 * per form of the rule union in `../types.ts`, as there.
 *
 * A leaf is a `Meta<I, S>` — the symbol and what the grammar ignored about
 * it — rather than the bare number, and `Meta<O>` is admitted at every row,
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

import type { Assert } from '../../asserts/types.ts'
import type { BoundedArray } from '../../types/array/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type { Const, Rule, Tuple, Variant, Set, Repeat, Option } from '../types.ts'

export type Meta<M, S extends number = number> =
    [M] extends [never] ? never :
    { readonly symbol: S, readonly meta: M }

// The widened row, and so the target of every monotonicity check: a subtree
// under a rule known only as `Rule`. It admits `Meta<O>` at every depth, not
// just at the top, because a mapping may sit anywhere — a tuple holding one
// mapped child is a tuple whose rule is still unknown.
type _AnyAst<I, O> =
    | Meta<I> // input symbols
    | Meta<O> // output symbols
    | readonly _AnyAst<I, O>[] // tuples and repeats
    | readonly [string, _AnyAst<I, O>] // variants

export type Ast<R extends Rule, I, O = never> =
    | Meta<O>
    | (Equal<R, Rule> extends true ? _AnyAst<I, O> :
        // EOF: a consumed end of input has no source element, so it contributes
        // no leaf — the node is empty, as an empty string's is.
        R extends null ? readonly[] :
        // number
        R extends number ? Meta<I, R> :
        // string
        R extends '' ? readonly[] :
        R extends string ? readonly Ast<number, I, O>[] :
        // Tuple
        R extends Tuple ? _TupleAst<R, I, O> :
        // Variant
        R extends Variant ? _VariantAst<R, I, O> :
        // Const
        R extends Const<infer D> ? Ast<D, I, O> :
        // Set
        R extends () => readonly['set'] ? never :
        R extends Set ? Meta<I> :
        // Repeat
        R extends Repeat<infer Min, infer Max, infer D> ? _RepeatAst<Min, Max, D, I, O>:
        //
        never)

type _MI = 'mi'
type _MO = 'mo'

type _Any = Assert<Equal<Ast<Rule, _MI, _MO>, _AnyAst<_MI, _MO>>>

type _Number = Assert<Equal<Ast<number, _MI, _MO>, Meta<_MO> | Meta<_MI>>>
type _Number0 = Assert<Equal<Ast<42, _MI, _MO>, Meta<_MO> | Meta<_MI, 42>>>
type _Number1 = Assert<Equal<Ast<42|-1, _MI, _MO>, Meta<_MO> | Meta<_MI, -1> | Meta<_MI, 42>>>
type _Number2 = Assert<Equal<Ast<number, _MI>, Meta<_MI>>>

type _Eof = Assert<Equal<Ast<null, _MI, _MO>, Meta<_MO> | readonly[]>>
// `document = [value, eof]`: the tuple keeps its arity, the EOF slot is empty.
type _Eof0 = Assert<Equal<Ast<readonly[42, null], _MI, _MO>, Meta<_MO> | readonly[Ast<42,_MI, _MO>, Meta<_MO> | readonly[]]>>
// An optional EOF: zero rounds, or one round holding the empty node.
type _Eof1 = Assert<Equal<Ast<Option<null>, _MI, _MO>, Meta<_MO> | readonly[] | readonly[Ast<null, _MI, _MO>]>>

// A narrower rule has a narrower AST: `A extends B` implies `Ast<A> extends
// Ast<B>`. EOF being `null` rather than `-1` is what keeps `number` inside
// the law — a rule typed `number` is never the end of input.
type _Mono<A extends B, B extends Rule> = Ast<A, _MI, _MO> extends Ast<B, _MI, _MO> ? true : false
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
type _Mapped = Assert<_Holds<readonly[Meta<_MO>], Ast<Rule, _MI, _MO>>>
type _Mapped0 = Assert<_Holds<readonly['a', Meta<_MO>], Ast<Rule, _MI, _MO>>>
type _Mapped1 = Assert<_Holds<readonly[readonly[Meta<_MO>]], Ast<Rule, _MI, _MO>>>
type _Mapped2 = Assert<_Holds<Ast<readonly[42, null], _MI, _MO>, Ast<Rule, _MI, _MO>>>

type _String = Assert<Equal<Ast<string, _MI, _MO>, Meta<_MO> | readonly Ast<number, _MI, _MO>[]>>
type _String0 = Assert<Equal<Ast<'hello', _MI, _MO>, Meta<_MO> | readonly Ast<number, _MI, _MO>[]>>
type _String1 = Assert<Equal<Ast<'', _MI, _MO>, Meta<_MO> | readonly[]>>
// `_String` and `_String0` compare `Ast` against `Ast`, so they hold whatever
// the element row says. These spell it out: a mapped code point stands where
// an unmapped one would, alone and beside one.
type _String2 = Assert<_Holds<readonly[Meta<_MO>], Ast<'a', _MI, _MO>>>
type _String3 = Assert<_Holds<readonly[Meta<_MI>, Meta<_MO>], Ast<'ab', _MI, _MO>>>

type _TupleAst<R extends Tuple, I, O> = { readonly[K in keyof R]: Ast<R[K], I, O> }

type _Tuple = Assert<Equal<Ast<[12, -1],_MI, _MO>, Meta<_MO> | readonly[Ast<12, _MI, _MO>, Ast<-1, _MI, _MO>]>>
type _Tuple0 = Assert<Equal<Ast<[], _MI, _MO>, Meta<_MO> | readonly[]>>
type _Tuple1 = Assert<Equal<Ast<[12, string], _MI, _MO>, Meta<_MO> | readonly[Ast<12, _MI, _MO>, Ast<string, _MI, _MO>]>>

type _PropertyName<V> =
    V extends string ? V :
    V extends number ? `${V}` :
    never

type _VariantAst<R extends Variant, I, O> =
    string extends keyof R ? readonly[string, Ast<R[string], I, O>] :
    {
        readonly[K in keyof R]: readonly[
            _PropertyName<K>,
            Ast<R[K], I, O>
        ]
    }[keyof R]

type _Variant = Assert<Equal<Ast<{ readonly a: 12, readonly b: 'hello' }, _MI, _MO>,
    Meta<_MO> | readonly['a', Ast<12, _MI, _MO>] | readonly['b', Ast<'hello', _MI, _MO>]>>
type _Variant0 = Assert<Equal<Ast<{}, _MI, _MO>, Meta<_MO>>>
type _Variant1 = Assert<Equal<Ast<Variant, _MI, _MO>, Meta<_MO> | readonly[string, Ast<Rule, _MI, _MO>]>>
type _Variant2 = Assert<Equal<Ast<{readonly 0:13}, _MI, _MO>, Meta<_MO> | readonly['0', Ast<13, _MI, _MO>]>>
type _Variant3 = Assert<Equal<Ast<Const<Variant>, _MI, _MO>, Meta<_MO> | readonly[string, Ast<Rule, _MI, _MO>]>>
type _Variant4 = Assert<Equal<Ast<{readonly[k in string]:42}, _MI, _MO>, Meta<_MO> | readonly[string, Meta<_MO>| Meta<_MI, 42>]>>

type _Const = Assert<Equal<Ast<Const<42>, _MI, _MO>, Ast<42, _MI, _MO>>>
type _Const0 = Assert<Equal<Ast<() => ['const', 42], _MI, _MO>, Ast<42, _MI, _MO>>>
type _Const1 = Assert<Equal<Ast<() => ['const', 'a'], _MI, _MO>, Ast<'a', _MI, _MO>>>

type _Set = Assert<Equal<Ast<Set, _MI, _MO>, Meta<_MO> | Meta<_MI>>>
type _Set0 = Assert<Equal<Ast<() => ['set'], _MI, _MO>, Meta<_MO> | never>>
type _Set1 = Assert<Equal<Ast<() => ['set', number], _MI, _MO>, Meta<_MO> | Meta<_MI>>>
type _Set2 = Assert<Equal<Ast<() => ['set', number, -1], _MI, _MO>, Meta<_MO> | Meta<_MI>>>

type _RepeatAst<Min extends number, Max extends number, D extends Rule, I, O> =
    BoundedArray<Min, Max, Ast<D, I, O>>

// The metadata pair is threaded by parameter, not read from the `_MI`/`_MO`
// the rows above are written against: a nested position carries whatever pair
// the caller passed. The assertions above compare `Ast` against `Ast`, so they
// hold either way; this one spells the expected side out.
type _MI2 = 'mi2'
type _MO2 = 'mo2'
type _Threaded = Assert<Equal<
    Ast<[12, { readonly a: 13 }, Option<14>], _MI2, _MO2>,
    Meta<_MO2> | readonly[
        Meta<_MO2> | Meta<_MI2, 12>,
        Meta<_MO2> | readonly['a', Meta<_MO2> | Meta<_MI2, 13>],
        Meta<_MO2> | readonly[] | readonly[Meta<_MO2> | Meta<_MI2, 14>]]>>

type _Repeat = Assert<Equal<Ast<Option<43>, _MI, _MO>, Meta<_MO> | readonly[] | readonly[Ast<43, _MI, _MO>]>>
type _Repeat0 = Assert<Equal<Ast<Repeat<0, 0, 43>, _MI, _MO>, Meta<_MO> | readonly[]>>
type _Repeat1 = Assert<Equal<Ast<Repeat<0, number, 43>, _MI, _MO>, Meta<_MO> | readonly Ast<43, _MI, _MO>[]>>
type _Repeat2 = Assert<Equal<
    Ast<Repeat<2, number, 43>, _MI, _MO>,
    Meta<_MO> | readonly[Ast<43, _MI, _MO>, Ast<43, _MI, _MO>, ...readonly Ast<43, _MI, _MO>[]]>>
