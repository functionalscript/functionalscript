import { stringToCodePointList } from '../../text/utf16/module.f.ts'
import { type Array2, isArray2, Tuple2 } from '../../types/array/module.f.ts'
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

export const rangeDecode = (r: bigint): Array2<number> =>
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
    if (!isArray2(a)) {
        throw `Invalid range ${ab}.`
    }
    return rangeEncode(...a)
}

export type None = readonly[]

export const none: None = []

export type Option<S> = {
    none: None
    some: S
}

export const option = <S extends Rule>(some: S): Option<S> => ({
    none,
    some,
})

export type Repeat0<T> = () => Option<readonly[T, Repeat0<T>]>

export const repeat0 = <T extends Rule>(some: T): Repeat0<T> => {
    const f = () => option([some, f] as const)
    return f
}

export type Repeat1<T> = readonly[T, Repeat0<T>]

export const repeat1 = <T extends Rule>(some: T): Repeat1<T> =>
    [some, repeat0(some)]

export type Join1<T, S> = readonly[T, Repeat0<readonly[S, T]>]

export const join1 = <T extends Rule, S extends Rule>(some: T, separator: S): Join1<T, S> =>
    [some, repeat0([separator, some])]

export type Join0<T, S> = Option<readonly[T, Repeat0<readonly[S, T]>]>

export const join0 = <T extends Rule, S extends Rule>(some: T, separator: S): Rule =>
    option(join1(some, separator))
