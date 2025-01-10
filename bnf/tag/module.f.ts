import { stringToCodePointList } from '../../text/utf16/module.f.ts'
import { toArray } from '../../types/list/module.f.ts'
import type { TerminalRange } from '../func/module.f.ts'

export type Sequence = readonly (Rule|TerminalRange)[]

export type Or = {
    readonly[k in string]: Sequence | Rule
}

export type Rule = () => Or | Sequence

const { fromEntries } = Object

const { fromCodePoint } = String

export const set = (s: string): Or =>
    fromEntries(toArray(stringToCodePointList(s)).map(v => [fromCodePoint(v), [[v, v]]] as const))

export const none: Sequence = []

export const option = (some: Sequence | Rule): Or => ({
    none,
    some,
})

export const repeat0 = (some: Rule): Rule => {
    const f = () => option([some, f])
    return f
}

export const repeat1 = (some: Rule): Sequence => [some, repeat0(some)]

export const join0 = (some: Rule, separator: Rule): Or =>
    option([some, repeat0(() => [separator, some])])
