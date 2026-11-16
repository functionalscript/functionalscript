/**
 * Implementation-private types for the lowering in `./module.f.js`.
 *
 * @module
 */

import type { StringSet } from '../../types/string_set/types.ts'
import type { DataRule, Rule as FRule } from '../types.ts'
import type { RuleNameMap, RuleSet } from './types.ts'
import type { PersistentMap } from '../../types/map/types.ts'

/** Separately supplied bodies, keyed by their reference identities. */
export type _Definitions = PersistentMap<FRule, DataRule>

/**
 * The lowering's memo: every front-end rule met so far with its name, the
 * names already taken — a rule is named before its body is lowered, so a
 * name can be taken before its rule is emitted — and the rules emitted.
 */
export type _State = {
    readonly names: RuleNameMap
    readonly taken: StringSet
    readonly ruleSet: RuleSet
}

/** One lowering step: the extended memo and what the step produced. */
export type _Lowered<T> = readonly [_State, T]

/** The recursive lowering step passed to its module-scope helpers. */
export type _Lower = (state: _State, hint: string, fr: FRule) => _Lowered<string>
