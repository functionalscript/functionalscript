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
import type { Const, DataRule, Info, Repeat, Rule, Set, Tuple, Variant } from '../types.ts'

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
 * type equality, which is the rule's spelling where the type is exact: a
 * literal's, or the one the front end's constructors give a thunk.
 */
type _Find<M extends RuleMap, R> =
    M extends readonly [infer H extends Mapping, ...infer T extends RuleMap]
        ? Equal<H[0], R> extends true ? readonly [ReturnType<H[1]>] : _Find<T, R>
        : undefined

/**
 * Whether a rule type is one of the union's own members rather than a
 * spelling: what `Rule` says a rule may be, not what one rule is.
 */
type _Widened<R> =
    number extends R ? true :
    string extends R ? true :
    Tuple extends R ? true :
    Variant extends R ? true :
    Set extends R ? true :
    Const<DataRule> extends R ? true :
    Info<readonly ['repeat', number, number, Rule]> extends R ? true :
    false

/** Whether every element of a tuple is a number literal. */
type _Literals<B> =
    B extends readonly [] ? true :
    B extends readonly [infer H, ...infer T] ? number extends H ? false : _Literals<T> :
    false

/** Whether every element of a tuple is an exact set. */
type _ExactSets<S> =
    S extends readonly [] ? true :
    S extends readonly [infer H, ...infer T] ? _ExactSet<H> extends true ? _ExactSets<T> : false :
    false

/**
 * Whether a set's spelling says the set: a constructor's arguments are
 * literals, or exact sets, all the way down.
 */
type _ExactSpelling<S> =
    S extends readonly ['range', infer T] ? string extends T ? false : true :
    S extends readonly ['set', infer T] ? string extends T ? false : true :
    S extends readonly ['rangeEncode', infer A, infer B] ? _Literals<readonly [A, B]> :
    S extends readonly ['union', ...infer Sets] ? _ExactSets<Sets> :
    S extends readonly ['remove', infer A, infer B] ? _ExactSets<readonly [A, B]> :
    false

/**
 * Whether a set type says the set: by its spelling where the front end
 * gave it one, else — a set written by hand — by its boundaries being
 * literals.
 */
type _ExactSet<R> =
    R extends Set<infer S>
        ? S extends readonly [string, ...unknown[]] ? _ExactSpelling<S> :
            R extends () => readonly ['set', ...infer B] ? _Literals<B> : false
        : false

/**
 * Whether a rule type says the rule's parts: a literal, or a form over
 * exact parts. A type this is not true of admits rules of many spellings,
 * so a rule of that type may or may not be a key, whatever the key is. A
 * repetition's `max` may be `number`, which is `Infinity`'s spelling and
 * no other bound's, since the front end refuses a bound that is not a
 * literal.
 */
type _Exact<R> =
    _Widened<R> extends true ? false :
    R extends null | number | string ? true :
    R extends Tuple ? { readonly [K in keyof R]: _Exact<R[K]> }[number] extends true ? true : false :
    R extends Variant ? { readonly [K in keyof R]: _Exact<Exclude<R[K], undefined>> }[keyof R] extends true ? true : false :
    R extends Const<infer D> ? _Exact<D> :
    R extends Set ? _ExactSet<R> :
    R extends Repeat<infer Min, infer _Max, infer D> ? number extends Min ? false : _Exact<D> :
    false

/**
 * What the keys a rule of type `R` may be return: every key assignable to
 * `R`, for an `R` that does not say its parts.
 */
type _Applicable<M extends RuleMap, R> =
    M[number] extends infer E
        ? E extends Mapping<infer K> ? K extends R ? ReturnType<E[1]> : never : never
        : never

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
 * its {@link Children} where it has none. A union is taken member by
 * member. A type that does not say its parts — `number`, `Tuple`, a bare
 * `Set`, `Rule` — is the children *or* what any key it could be returns,
 * since the rule it stands for may be a key or may not.
 */
export type Mapped<R extends Rule, M extends RuleMap> =
    // The whole union first, before it is taken apart: its tuple member
    // holds the whole union again, so member by member it would not end.
    Equal<R, Rule> extends true ? _Any<M> :
    R extends unknown ? _MappedOne<R, M> : never

type _MappedOne<R extends Rule, M extends RuleMap> =
    _Exact<R> extends true
        ? _Find<M, R> extends readonly [infer T] ? T : Children<R, M>
        : Children<R, M> | _Applicable<M, R>

/** Whether a key other than the one at `K`, whose rule is `R`, has `R`'s type. */
type _KeyTwice<M extends RuleMap, K extends keyof M, R> = true extends {
    readonly [J in keyof M]: J extends K ? false :
        M[J] extends Mapping<infer RJ> ? Equal<RJ, R> : false
}[number] ? true : false

/**
 * A mapping nothing is assignable to: its function slot takes no function.
 * It keeps a mapping's shape, with a rule where the rule goes, rather than
 * being `never` outright, because `tsc` types the map literal against
 * {@link Checked} of the constraint before it infers `M`, and a `never`
 * where the key goes costs the key its `readonly` inference.
 */
type _Refused = readonly [Rule, never]

/**
 * `M` with every mapping's parameter spelled as what the rewrite hands it,
 * so that a map whose declared input is narrower than the actual children
 * is a compile error at `rewrite`, where `M` is whole. Refused there too —
 * as a mapping nothing is assignable to — are two keys of one type, as the
 * rewrite refuses two keys of one spelling, and a key whose type does not
 * say its parts, which no rule could be found by.
 */
export type Checked<M extends RuleMap> = {
    readonly [K in keyof M]: M[K] extends Mapping<infer R>
        ? _KeyTwice<M, K, R> extends true ? _Refused :
            _Exact<R> extends true
                ? readonly [R, (children: Children<R, M>) => unknown]
                : _Refused
        : _Refused
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
    readonly [_Refused, _Refused]>>
// A union is mapped member by member, and a type that does not say its
// parts may be any key it admits.
type _M42 = readonly [Mapping<42, 42, string>]
type _MappedUnion = Assert<Equal<Mapped<42 | 43, _M42>, string | 43>>
type _MappedNumber = Assert<Equal<Mapped<number, _M42>, number | string>>
type _MappedTupleWide = Assert<Equal<Mapped<readonly [number], _M42>, readonly [number | string]>>
type _MappedNotApplicable = Assert<Equal<Mapped<string, _M42>, readonly number[]>>
type _MappedWideTuple = Assert<Equal<Mapped<Tuple, _M42>, readonly _Any<_M42>[]>>
// A key whose type does not say its parts is refused, wherever the width is.
type _CheckedWide = Assert<Equal<Checked<readonly [Mapping<number, number, string>]>, readonly [_Refused]>>
type _CheckedWideInside = Assert<Equal<Checked<readonly [Mapping<readonly [Tuple, 'x'], unknown, string>]>, readonly [_Refused]>>
type _CheckedWideSet = Assert<Equal<Checked<readonly [Mapping<Set, number, string>]>, readonly [_Refused]>>
type _CheckedWideRepeat = Assert<Equal<Checked<readonly [Mapping<Repeat<number, number, 'x'>, unknown, string>]>, readonly [_Refused]>>
// A set's spelling must be spelled too: a constructor given a widened
// argument, at any depth, and a hand-written set without literal
// boundaries, are refused; a `max` of `number` is unbounded, not widened.
type _CheckedWideRange = Assert<Equal<Checked<readonly [Mapping<Set<readonly ['range', string]>, number, string>]>, readonly [_Refused]>>
type _CheckedWideEncode = Assert<Equal<Checked<readonly [Mapping<Set<readonly ['rangeEncode', number, 58]>, number, string>]>, readonly [_Refused]>>
type _CheckedWideUnion = Assert<Equal<
    Checked<readonly [Mapping<Set<readonly ['union', Set<readonly ['range', '09']>, Set<readonly ['set', string]>]>, number, string>]>,
    readonly [_Refused]>>
type _CheckedWideRemove = Assert<Equal<
    Checked<readonly [Mapping<Set<readonly ['remove', Set<readonly ['range', ' ~']>, Set<readonly ['range', string]>]>, number, string>]>,
    readonly [_Refused]>>
type _CheckedHandSet = Assert<Equal<Checked<readonly [Mapping<() => readonly ['set', ...(readonly number[])], number, string>]>, readonly [_Refused]>>
type _CheckedExactUnion = Assert<Equal<
    Checked<readonly [Mapping<Set<readonly ['union', Set<readonly ['range', '09']>, Set<readonly ['remove', Set<readonly ['set', 'ab']>, Set<readonly ['rangeEncode', 97, 97]>]>]>, number, string>]>,
    readonly [readonly [Set<readonly ['union', Set<readonly ['range', '09']>, Set<readonly ['remove', Set<readonly ['set', 'ab']>, Set<readonly ['rangeEncode', 97, 97]>]>]>, (children: number) => unknown]]>>
// A set with a widened spelling may be any exact set that spelling admits.
type _MappedWideRange = Assert<Equal<Mapped<Set<readonly ['range', string]>, _Spelled>, number | bigint>>
type _CheckedExact = Assert<Equal<
    Checked<readonly [Mapping<readonly [Repeat<0, number, Set<readonly ['range', '09']>>, { readonly a: 'x' }, Const<'y'>, null], unknown, string>]>,
    readonly [readonly [readonly [Repeat<0, number, Set<readonly ['range', '09']>>, { readonly a: 'x' }, Const<'y'>, null], (children: readonly [readonly number[], readonly ['a', readonly number[]], readonly number[], readonly []]) => unknown]]>>
// Two sets spelled differently are two keys, so a mapping of one leaves
// the other as it is.
type _Letter = Set<readonly ['range', 'az']>
type _Spelled = readonly [Mapping<Set<readonly ['range', '09']>, number, bigint>]
type _MappedSpelling = Assert<Equal<Mapped<Set<readonly ['range', '09']>, _Spelled>, bigint>>
type _MappedOtherSpelling = Assert<Equal<Mapped<_Letter, _Spelled>, number>>
type _MappedBareSet = Assert<Equal<Mapped<Set, _Spelled>, number | bigint>>
type _MappedRepeatSpelling = Assert<Equal<
    Mapped<readonly [Repeat<1, number, Set<readonly ['range', '09']>>, Repeat<1, number, _Letter>], _Spelled>,
    readonly [readonly [bigint, ...(readonly bigint[])], readonly [number, ...(readonly number[])]]>>
