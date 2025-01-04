/**
 * Rules for serializing and deserializing the BNF grammar.
 *
 * @module
 */

import type { TerminalRange } from '../func/module.f.ts'

export type Sequence<Id> = readonly (TerminalRange|Id)[]
export type Rule<Id> = readonly Sequence<Id>[]

export type RuleMap<Id extends string> = { readonly[k in Id]: Rule<Id> }
