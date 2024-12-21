import * as list from '../../types/list/module.f.mjs'
const { flat, reduce, empty } = list
import * as O from '../../types/object/module.f.mjs'
import * as Operator from '../../types/function/operator/module.f.mjs'

type Obj<T> = {
    readonly [k in string]: Unknown<T>
}

type Arr<T> = readonly Unknown<T>[]

type Primitive = |
    boolean |
    string |
    number |
    null

type Unknown<T> = |
    Arr<T>|
    Obj<T>|
    null|
    T

const jsonStringify = JSON.stringify

export const stringSerialize
    : (_: string) => list.List<string>
    = input => [jsonStringify(input)]

export const numberSerialize
    : (_: number) => list.List<string>
    = input => [jsonStringify(input)]

export const nullSerialize = ['null']

const trueSerialize = ['true']

const falseSerialize = ['false']

export const boolSerialize
    : (_: boolean) => list.List<string>
    = value => value ? trueSerialize : falseSerialize

const comma = [',']

const joinOp
    : Operator.Reduce<list.List<string>>
    = b => prior => flat([prior, comma, b])

const join
    : (input: list.List<list.List<string>>) => list.List<string>
    = reduce(joinOp)(empty)

const wrap
    : (open: string) => (close: string) => (input: list.List<list.List<string>>) => list.List<string>
    = open => close => {
    const seqOpen = [open]
    const seqClose = [close]
    return input => flat([seqOpen, join(input), seqClose])
}

export const objectWrap = wrap('{')('}')

export const arrayWrap = wrap('[')(']')

type Entry<T> = O.Entry<Unknown<T>>

type Entries<T> = list.List<Entry<T>>

type MapEntries<T> = (entries: Entries<T>) => Entries<T>
