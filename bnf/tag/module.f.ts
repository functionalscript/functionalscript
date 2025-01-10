import { stringToCodePointList } from '../../text/utf16/module.f.ts'
import { map, toArray } from '../../types/list/module.f.ts'

// Types

export type Range = bigint

export type Sequence = readonly Rule[]

export type Or = {
    readonly[k in string]: Rule
}

export type DataRule = Or | Sequence | Range | string

export type LazyRule = () => DataRule

export type Rule = DataRule | LazyRule

//

const { fromEntries } = Object

const { fromCodePoint } = String

const offset = 24n

const mask = (1n << offset) - 1n

export const rangeEncode = (a: number, b: number): Range =>
    (BigInt(a) << offset) | BigInt(b)

export const oneEncode = (a: number): Range => rangeEncode(a, a)

export const rangeDecode = (r: bigint): readonly[number, number] =>
    [Number(r >> offset), Number(r & mask)]

const mapOneEncode = map(oneEncode)

export const str = (s: string): readonly Range[] | Range => {
    const x = toArray(mapOneEncode(stringToCodePointList(s)))
    return x.length === 1 ? x[0] : x
}

const mapEntry = map((v: number) => [fromCodePoint(v), oneEncode(v)])

export const set = (s: string): Or =>
    fromEntries(toArray(mapEntry(stringToCodePointList(s))))

export const range = (ab: string): Range => {
    const a = toArray(stringToCodePointList(ab))
    if (a.length !== 2) {
        throw `Invalid range ${ab}.`
    }
    return rangeEncode(...a as readonly[number, number])
}

export type None = readonly[]

export const none: None = []

export type Option<S extends Rule> = {
    none: None
    some: S
}

export const option = <S extends Rule>(some: S): Option<S> => ({
    none,
    some,
})

export const repeat0 = (some: Rule): Rule => {
    const f = () => option([some, f])
    return f
}

export const repeat1 = (some: Rule): Sequence => [some, repeat0(some)]

export const join0 = (some: Rule, separator: Rule): Rule =>
    option([some, repeat0(() => [separator, some])])
