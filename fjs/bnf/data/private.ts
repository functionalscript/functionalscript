import type { StringMap } from "../../types/object/types.ts"
import type { EmptyTag, Rule, RuleSet } from "./types.ts"
import type { Rule as FRule } from '../types.ts'

export type _EmptyTagMap = StringMap<EmptyTag>

export type _FRuleMap = StringMap<FRule>

export type _NewRule = (m: _FRuleMap) => readonly [_FRuleMap, RuleSet, Rule]
