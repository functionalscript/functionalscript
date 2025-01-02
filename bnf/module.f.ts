export type TerminalRange = readonly[number, number]

export type Sequence = readonly Rule[]
export type Or = { readonly or: Sequence }

export type DataRule = Sequence|Or|TerminalRange|string

//
export type LazyRule = () => DataRule
export type Rule = DataRule|LazyRule
