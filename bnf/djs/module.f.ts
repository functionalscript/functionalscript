import type { TerminalRange } from '../module.f.ts'

type Sequence = readonly Rule[]
type Or = { readonly or: Sequence }

type DataRule = Sequence|Or|TerminalRange|string

//
type Id = string

type LazyRule = { readonly id: Id }
type Rule = DataRule|LazyRule

type RuleMap = { readonly[k in Id]: Rule }

//
