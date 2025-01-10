import { stringToCodePointList } from '../../text/utf16/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'
import type { TerminalRange } from '../func/module.f.ts'

export type Sequence = readonly (TerminalRange | Rule)[]

export type Or = {
    readonly[k in string]: Sequence|Rule|number
}

export type Rule = () => Or|Sequence

export const set = (s: string): Or =>
    Object.fromEntries(toArray(stringToCodePointList(s)).map(v => [String.fromCodePoint(v), [[v, v]]] as const))
