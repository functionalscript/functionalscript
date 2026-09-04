/**
 * Type-level API of the EBNF front end: what a rule is, and the tagged shapes
 * a thunk may return.
 *
 * @module
 */

import type { Assert } from '../asserts/types.ts'
import type { Phantom } from '../types/phantom/types.ts'
import type { Equal } from '../types/ts/types.ts'

/**
 * A plain value is a rule directly, told from the others by its JavaScript
 * type: `null` is the end of input, a number one symbol, a string its
 * symbols in order, an array a sequence, an object a choice.
 *
 * `null` is EOF rather than `-1` so that `number` means an ordinary symbol
 * and nothing else: a rule typed `number` is never the end of input, and
 * the AST of a narrower rule is always assignable to the AST of a wider one.
 * The input stream still carries EOF as `-1`; that is the alphabet's
 * business, not the grammar's spelling.
 */
export type DataRule =
    | null
    | number
    | string
    | Tuple
    | Variant

export type Tuple =
    readonly Rule[]

/**
 * A choice between named alternatives.
 *
 * This is an abstraction in the sense of `AbstractRequiredMap` in
 * `fjs/types/object/types.ts`, not a concrete object type: no object carries
 * every string as a key, so reading an alternative that isn't there is typed
 * as a `Rule` and yields `undefined` at runtime. That is the right side of
 * the trade-off for a grammar literal, whose tags are static and all present
 * — `createValue(p, v).string` is a rule, not a rule that might be missing.
 * Looking a branch up by a tag that arrived at runtime is the data layer's
 * job, where the variant is an open `StringMap` and a miss is typed.
 *
 * The record is spelled inline rather than as `AbstractRequiredMap<string,
 * Rule>` because it is mutually recursive with `Rule`, and an alias may not
 * reach itself through another alias's instantiation (TS2456).
 */
export type Variant =
    { readonly[k in string]: Rule }

// The abstraction stated as a type-level fact: every key reads as a rule,
// the absent ones included. A `?` here would make each alternative an author
// wrote read as possibly missing, which is the lie in the other direction.
type _AbsentAlternative = Assert<Equal<Variant['missing'], Rule>>

export type Rule =
    | DataRule
    | Thunk

export type Thunk =
    | Const<DataRule>
    | Set
    // The same as Repeat<number, number, Rule>
    // but we can't use it because of circular dependencies.
    | Info<readonly['repeat', number, number, Rule]>

export type Info<T extends readonly[string, ...readonly unknown[]]> =
    () => T

export type Const<R extends DataRule> =
    Info<readonly['const', R]>

/**
 * One symbol from a set of ranges.
 *
 * `S` is the set's *spelling* — the constructor it was built with and the
 * arguments it was given, as `range('09')` is `readonly ['range', '09']` —
 * carried as a phantom that nothing reads back. Two sets spelled differently
 * are two rules, and the spelling makes them two types, which is what lets
 * a map keyed by spelling (`../map`) find a rule by its type: without it
 * every set would be one type.
 */
export type Set<S = unknown> =
    Phantom<Info<readonly['set', ...readonly number[]]>, S>

// The spelling tells sets apart, and a set without one is any set.
type _SetSpelling = Assert<Equal<
    Set<readonly ['range', '09']> extends Set<readonly ['range', 'az']> ? true : false,
    false>>
type _SetAny = Assert<Set<readonly ['range', '09']> extends Set ? true : false>

export type Repeat<Min extends number, Max extends number, R extends Rule> =
    Info<readonly['repeat', Min, Max, R]>

export type Infinity =
    typeof Infinity

export type RepeatFrom<Min extends number, R extends Rule> =
    Repeat<Min, Infinity, R>

export type Times<N extends number, R extends Rule> =
    Repeat<N, N, R>

export type Option<R extends Rule> =
    Repeat<0, 1, R>
