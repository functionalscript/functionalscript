// @ts-self-types="./module.f.d.mts"
import list, * as List from '../../types/list/module.f.mjs'
const { flat, reduce, empty } = list
import * as O from '../../types/object/module.f.mjs'
import * as Operator from '../../types/function/operator/module.f.mjs'

/**
 * @template T
 * @typedef {{
 *  readonly [k in string]: Unknown<T>
 * }} Obj<T>
 */

/**
 * @template T
 *  @typedef {readonly Unknown<T>[]} Arr<T>
 */

/**
 * @typedef {|
* boolean |
* string |
* number |
* null
* } Primitive
*/

/**
 * @template T
 * @typedef {|
 * Arr<T>|
 * Obj<T>|
 * null|
 * T
 * } Unknown<T>
 */

const jsonStringify = JSON.stringify

/** @type {(_: string) => List.List<string>} */
export const stringSerialize = input => [jsonStringify(input)]

/** @type {(_: number) => List.List<string>} */
export const numberSerialize = input => [jsonStringify(input)]

export const nullSerialize = ['null']

const trueSerialize = ['true']

const falseSerialize = ['false']

/** @type {(_: boolean) => List.List<string>} */
export const boolSerialize = value => value ? trueSerialize : falseSerialize

const comma = [',']

/** @type {Operator.Reduce<List.List<string>>} */
const joinOp = b => prior => flat([prior, comma, b])

/** @type {(input: List.List<List.List<string>>) => List.List<string>} */
const join = reduce(joinOp)(empty)

/** @type {(open: string) => (close: string) => (input: List.List<List.List<string>>) => List.List<string>} */
const wrap = open => close => {
    const seqOpen = [open]
    const seqClose = [close]
    return input => flat([seqOpen, join(input), seqClose])
}

export const objectWrap = wrap('{')('}')

export const arrayWrap = wrap('[')(']')

/**
 * @template T
 * @typedef {O.Entry<Unknown<T>>} Entry<T>
*/

/**
 * @template T
 *  @typedef {(List.List<Entry<T>>)} Entries<T>
*/

/**
 * @template T
 * @typedef {(entries: Entries<T>) => Entries<T>} MapEntries<T>
*/
