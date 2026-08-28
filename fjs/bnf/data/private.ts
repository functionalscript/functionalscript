/**
 * Implementation-private types for the `toData` conversion.
 */

import type { Rule as FRule } from '../types.ts'
import type { StringMap } from '../../types/object/types.ts'
import type { Rule, RuleSet } from './types.ts'

/**
 * Functional rules already converted, keyed by the generated rule name — the
 * memo that keeps a shared functional rule one named data rule.
 */
export type _FRuleMap = StringMap<FRule>

/**
 * One conversion step: given the memo so far, produces the extended memo, the
 * rules the step generated, and the converted rule itself.
 */
export type _NewRule = (m: _FRuleMap) => readonly [_FRuleMap, RuleSet, Rule]
