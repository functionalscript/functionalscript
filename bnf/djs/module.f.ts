/**
 * Rules for serializing and deserializing the BNF grammar.
 *
 * @module
 */

import type { TerminalRange } from '../module.f.ts'

export type Sequence = readonly Rule[]
export type Or = { readonly or: Sequence }

export type DataRule = Sequence|Or|TerminalRange|string

//
export type Id = string

export type LazyRule = { readonly id: Id }
export type Rule = DataRule|LazyRule

export type RuleMap = { readonly[k in Id]: Rule }
