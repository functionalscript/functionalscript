/**
 * JSON serializer for deterministic string output.
 *
 * @module
 */
import { flat, reduce, empty, type List } from '../../../types/list/module.f.ts'
import { type Reduce } from '../../../types/function/operator/module.f.ts'

const jsonStringify = JSON.stringify

/**
 * Serializes a string as a JSON string literal.
 */
export const stringSerialize
    : (_: string) => List<string>
    = input => [jsonStringify(input)]

/**
 * Serializes a number as a JSON number literal.
 */
export const numberSerialize
    : (_: number) => List<string>
    = input => [jsonStringify(input)]

/**
 * Shared serialized representation for `null`.
 */
export const nullSerialize = ['null']

const trueSerialize = ['true']

const falseSerialize = ['false']

export const boolSerialize
    : (_: boolean) => List<string>
    = value => value ? trueSerialize : falseSerialize

const comma = [',']

const joinOp
    : Reduce<List<string>>
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

/**
 * Wraps serialized entries into a JSON array.
 */
export const arrayWrap
    : (input: List<List<string>>) => List<string>
    = wrap('[')(']')
