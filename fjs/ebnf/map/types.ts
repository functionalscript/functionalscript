/**
 * Type-level API of the EBNF rule mapping: what a rule's AST becomes once the
 * rules it reaches are rewritten.
 *
 * A {@link RuleMap} is a list of {@link Mapping}s, each keyed by a rule the
 * author holds and carrying the function that rewrites what that rule
 * matches. {@link Mapped} is the AST of a rule under such a map: the rows of
 * `Ast<R>` in `../ast/types.ts`, with every mapped rule's node replaced by
 * what its function returns — the rule itself included. {@link Children} is
 * the same with the rule's own mapping left out: what its function receives.
 *
 * The empty map rewrites nothing, so `Mapped<R, readonly []>` is `Ast<R>`;
 * the assertions at the end pin that law, one per row.
 *
 * @module
 */

import type { Assert } from '../../asserts/types.ts'
import type { BoundedArray } from '../../types/array/types.ts'
import type { Equal } from '../../types/ts/types.ts'
import type { Ast } from '../ast/types.ts'
import type { Const, Repeat, Rule, Set, Tuple, Variant } from '../types.ts'

/**
 * The rewrite of one rule: the rule the author holds, and a function from
 * what the rule matches — with the rules under it already rewritten — to a
 * value. `I` is what the function takes, and `rewrite` checks it against
 * {@link Children} of the rule under the whole map, so a mapping declares
 * its input and the map proves it.
 */
export type Mapping<R extends Rule = Rule, I = never, T = unknown> =
    readonly [rule: R, f: (children: I) => T]

/** The mappings of a grammar, in any order; one per rule. */
export type RuleMap = readonly Mapping[]

/**
 * What the mapping keyed by `R` in `M` returns, wrapped so that a mapping
 * returning `undefined` is told from no mapping at all. A key matches by
 * type equality, which is the spelling the rewrite matches by, where the
 * types are the literal ones the front end's constructors give.
 */
type _Find<M extends RuleMap, R> =
    M extends readonly [infer H extends Mapping, ...infer T extends RuleMap]
        ? Equal<H[0], R> extends true ? readonly [ReturnType<H[1]>] : _Find<T, R>
        : undefined

/** Everything a mapping of `M` may build. */
type _Outputs<M extends RuleMap> = ReturnType<M[number][1]>

/** Any AST, or anything a mapping of `M` builds in its place. */
type _Any<M extends RuleMap> =
    | number
    | readonly _Any<M>[]
    | readonly [string, _Any<M>]
    | _Outputs<M>

type _ToString<V> =
    V extends string ? V :
    V extends number ? `${V}` :
    never

type _TupleChildren<R extends Tuple, M extends RuleMap> =
    { readonly [K in keyof R]: Mapped<R[K], M> }

type _VariantChildren<R extends Variant, M extends RuleMap> =
    string extends keyof R ? readonly [string, Mapped<Rule, M>] :
    {
        readonly [K in keyof R]: readonly [
            _ToString<K>,
            Mapped<Exclude<R[K], undefined>, M>
        ]
    }[keyof R]

/**
 * What a mapping of `R` receives: the AST of `R` with the rules under it
 * rewritten by `M`, and `R`'s own mapping not yet applied. The rows are
 * `Ast<R>`'s, each child taken through {@link Mapped}. A `const` thunk's
 * children are its payload's whole rewrite, since the thunk *is* the rule
 * its payload spells and the payload may be mapped in its own right.
 */
export type Children<R extends Rule, M extends RuleMap> =
    Equal<R, Rule> extends true ? _Any<M> :
    // EOF
    R extends null ? readonly [] :
    // number
    R extends number ? R :
    // string
    R extends '' ? readonly [] :
    R extends string ? readonly number[] :
    // Tuple
    R extends Tuple ? _TupleChildren<R, M> :
    // Variant
    R extends Variant ? _VariantChildren<R, M> :
    // Const
    R extends Const<infer D> ? Mapped<D, M> :
    // Set
    R extends () => readonly ['set'] ? never :
    R extends Set ? number :
    // Repeat
    R extends Repeat<infer Min, infer Max, infer D> ? BoundedArray<Min, Max, Mapped<D, M>> :
    //
    never

/**
 * The AST of `R` under `M`: what `R`'s mapping returns where it has one, and
 * its {@link Children} where it has none.
 */
export type Mapped<R extends Rule, M extends RuleMap> =
    _Find<M, R> extends readonly [infer T] ? T : Children<R, M>

/** Whether a key other than the one at `K`, whose rule is `R`, has `R`'s type. */
type _KeyTwice<M extends RuleMap, K extends keyof M, R> = true extends {
    readonly [J in keyof M]: J extends K ? false :
        M[J] extends Mapping<infer RJ> ? Equal<RJ, R> : false
}[number] ? true : false

/**
 * `M` with every mapping's parameter spelled as what the rewrite hands it,
 * so that a map whose declared input is narrower than the actual children
 * is a compile error at `rewrite`, where `M` is whole. Two keys of one
 * type are refused there too — as `never`, which nothing is assignable
 * to — as the rewrite refuses two keys of one spelling: one would silently
 * win.
 */
export type Checked<M extends RuleMap> = {
    readonly [K in keyof M]: M[K] extends Mapping<infer R>
        ? _KeyTwice<M, K, R> extends true
            ? never
            : readonly [R, (children: Children<R, M>) => unknown]
        : never
}

// The law: the empty map is the identity, row by row.

type _None = readonly []

type _IdAny = Assert<Equal<Mapped<Rule, _None>, Ast<Rule>>>
type _IdEof = Assert<Equal<Mapped<null, _None>, Ast<null>>>
type _IdNumber = Assert<Equal<Mapped<42, _None>, Ast<42>>>
type _IdString = Assert<Equal<Mapped<'hello', _None>, Ast<'hello'>>>
type _IdEmpty = Assert<Equal<Mapped<'', _None>, Ast<''>>>
type _IdTuple = Assert<Equal<Mapped<readonly [12, 'a', null], _None>, Ast<readonly [12, 'a', null]>>>
type _IdVariant = Assert<Equal<
    Mapped<{ readonly a: 12, readonly b: 'hello' }, _None>,
    Ast<{ readonly a: 12, readonly b: 'hello' }>>>
type _IdOpenVariant = Assert<Equal<Mapped<Variant, _None>, Ast<Variant>>>
type _IdConst = Assert<Equal<Mapped<Const<{ readonly a: 12 }>, _None>, Ast<Const<{ readonly a: 12 }>>>>
type _IdSet = Assert<Equal<Mapped<Set, _None>, Ast<Set>>>
type _IdEmptySet = Assert<Equal<Mapped<() => readonly ['set'], _None>, Ast<() => readonly ['set']>>>
type _IdRepeat = Assert<Equal<Mapped<Repeat<0, 1, 43>, _None>, Ast<Repeat<0, 1, 43>>>>
type _IdRepeatFrom = Assert<Equal<Mapped<Repeat<2, number, 43>, _None>, Ast<Repeat<2, number, 43>>>>

// A mapping replaces its rule's node wherever the rule appears, and the
// rule's own function receives its children with the rule not yet applied.

type _Digit = () => readonly ['set', 48, 58]
type _M = readonly [Mapping<_Digit, number, bigint>]

type _MappedLeaf = Assert<Equal<Mapped<_Digit, _M>, bigint>>
type _ChildrenLeaf = Assert<Equal<Children<_Digit, _M>, number>>
type _MappedTuple = Assert<Equal<Mapped<readonly [_Digit, 'x'], _M>, readonly [bigint, readonly number[]]>>
type _MappedVariant = Assert<Equal<
    Mapped<{ readonly d: _Digit, readonly e: null }, _M>,
    readonly ['d', bigint] | readonly ['e', readonly []]>>
type _MappedRepeat = Assert<Equal<Mapped<Repeat<1, 2, _Digit>, _M>, readonly [bigint] | readonly [bigint, bigint]>>
type _MappedConst = Assert<Equal<Mapped<Const<readonly [_Digit]>, _M>, readonly [bigint]>>
// A widened rule may hold any mapped rule, so its AST admits every output.
type _MappedAny = Assert<Equal<Mapped<Rule, _M>, _Any<_M>>>
type _MappedAnyHoldsOutput = Assert<bigint extends Mapped<Rule, _M> ? true : false>
// A mapping that returns `undefined` is a mapping, not the absence of one.
type _MappedUndefined = Assert<Equal<Mapped<_Digit, readonly [Mapping<_Digit, number, undefined>]>, undefined>>
// A key is matched by type equality, so a look-alike rule is not the key.
type _MappedOther = Assert<Equal<Mapped<() => readonly ['set', 48, 59], _M>, number>>
// The check rewrites the parameter and keeps the key.
type _Checked = Assert<Equal<
    Checked<readonly [Mapping<readonly [_Digit, _Digit], readonly [number, number], string>, Mapping<_Digit, number, bigint>]>,
    readonly [
        readonly [readonly [_Digit, _Digit], (children: readonly [bigint, bigint]) => unknown],
        readonly [_Digit, (children: number) => unknown],
    ]>>
// Two keys of one type are refused, whatever their functions.
type _CheckedTwice = Assert<Equal<
    Checked<readonly [Mapping<_Digit, number, bigint>, Mapping<_Digit, number, string>]>,
    readonly [never, never]>>
// Two sets spelled differently are two keys, so a mapping of one leaves
// the other as it is.
type _Letter = Set<readonly ['range', 'az']>
type _Spelled = readonly [Mapping<Set<readonly ['range', '09']>, number, bigint>]
type _MappedSpelling = Assert<Equal<Mapped<Set<readonly ['range', '09']>, _Spelled>, bigint>>
type _MappedOtherSpelling = Assert<Equal<Mapped<_Letter, _Spelled>, number>>
type _MappedRepeatSpelling = Assert<Equal<
    Mapped<readonly [Repeat<1, number, Set<readonly ['range', '09']>>, Repeat<1, number, _Letter>], _Spelled>,
    readonly [readonly [bigint, ...(readonly bigint[])], readonly [number, ...(readonly number[])]]>>
