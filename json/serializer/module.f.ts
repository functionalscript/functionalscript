import { flat, reduce, empty, type List } from '../../types/list/module.f.ts'
import type * as O from '../../types/object/module.f.ts'
import type * as Operator from '../../types/function/operator/module.f.ts'

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
    : (_: string) => List<string>
    = input => [jsonStringify(input)]

export const numberSerialize
    : (_: number) => List<string>
    = input => [jsonStringify(input)]

export const nullSerialize = ['null']

const trueSerialize = ['true']

const falseSerialize = ['false']

export const boolSerialize
    : (_: boolean) => List<string>
    = value => value ? trueSerialize : falseSerialize

const comma = [',']

const joinOp
    : Operator.Reduce<List<string>>
    = b => prior => flat([prior, comma, b])

const join
    : (input: List<List<string>>) => List<string>
    = reduce(joinOp)(empty)

const wrap
    : (open: string) => (close: string) => (input: List<List<string>>) => List<string>
    = open => close => {
        const seqOpen = [open]
        const seqClose = [close]
        return input => flat([seqOpen, join(input), seqClose])
    }

export const objectWrap
    : (input: List<List<string>>) => List<string>
    = wrap('{')('}')

export const arrayWrap
    : (input: List<List<string>>) => List<string>
    = wrap('[')(']')

type Entry<T> = O.Entry<Unknown<T>>

type Entries<T> = List<Entry<T>>

type MapEntries<T> = (entries: Entries<T>) => Entries<T>
