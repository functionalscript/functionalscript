/**
 * Type-level API of the EBNF front end: what a rule is, and the tagged shapes
 * a thunk may return.
 *
 * @module
 */

import type { Assert } from '../asserts/types.ts'
import type { Equal } from '../types/ts/types.ts'

export type DataRule =
    | number
    | string
    | Tuple
    | Variant

export type Tuple =
    readonly Rule[]

/**
 * A choice between named alternatives.
 *
 * The keys are open, so a value is optional: an absent alternative reads as
 * `undefined` rather than as a rule. The record is spelled inline rather than
 * as `StringMap<Rule>` because it is mutually recursive with `Rule`, and an
 * alias may not reach itself through another alias's instantiation.
 */
export type Variant =
    { readonly[k in string]?: Rule }

// An alternative that isn't there reads as `undefined` rather than as a rule.
// `types/ts/types.ts` states that rule for open string-keyed records in
// general; this pins it for `Variant`, where dropping the `?` would type an
// absent branch as a grammar rule.
type _AbsentAlternative = Assert<Equal<Variant['missing'], Rule | undefined>>

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

export type Set =
    Info<readonly['set', ...readonly number[]]>

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
