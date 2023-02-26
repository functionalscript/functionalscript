const list = require('../../types/list/module.f.cjs')
const { next, flat, reduce, map, empty } = list
const { concat } = require('../../types/string/module.f.cjs')
const object = require('../../types/object/module.f.cjs')
const { at } = object
const operator = require('../../types/function/operator/module.f.cjs')
const { compose, fn } = require('../../types/function/module.f.cjs')
const { entries } = Object

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

/** @type {(_: string) => list.List<string>} */
const stringSerialize = input => [jsonStringify(input)]

/** @type {(_: number) => list.List<string>} */
const numberSerialize = input => [jsonStringify(input)]

const nullSerialize = ['null']

const trueSerialize = ['true']

const falseSerialize = ['false']

/** @type {(_: boolean) => list.List<string>} */
const boolSerialize = value => value ? trueSerialize : falseSerialize

const colon = [':']
const comma = [',']

/** @type {operator.Reduce<list.List<string>>} */
const joinOp = b => prior => flat([prior, comma, b])

/** @type {(input: list.List<list.List<string>>) => list.List<string>} */
const join = reduce(joinOp)(empty)

/** @type {(open: string) => (close: string) => (input: list.List<list.List<string>>) => list.List<string>} */
const wrap = open => close => {
    const seqOpen = [open]
    const seqClose = [close]
    return input => flat([seqOpen, join(input), seqClose])
}

const objectWrap = wrap('{')('}')

const arrayWrap = wrap('[')(']')

/**
 * @template T
 * @typedef {object.Entry<Unknown<T>>} Entry<T>
*/

/**
 * @template T
 *  @typedef {(list.List<Entry<T>>)} Entries<T>
*/

/**
 * @template T
 * @typedef {(entries: Entries<T>) => Entries<T>} MapEntries<T>
*/

/** @type {<T>(mapEntries: MapEntries<T>) => (value: Unknown<T>) => list.List<string>} */
const serialize = sort => {
    /** @typedef {typeof sort extends MapEntries<infer T> ? T : never} T */
    /** @type {(kv: readonly[string, Unknown<T>]) => list.List<string>} */
    const propertySerialize = ([k, v]) => flat([
        stringSerialize(k),
        colon,
        f(v)
    ])
    const mapPropertySerialize = map(propertySerialize)
    /** @type {(object: Object) => list.List<string>} */
    const objectSerialize = fn(entries)
        .then(sort)
        .then(mapPropertySerialize)
        .then(objectWrap)
        .result
    /** @type {(value: Unknown<T>) => list.List<string>} */
    const f = value => {
        switch (typeof value) {
            case 'boolean': { return boolSerialize(value) }
            case 'number': { return numberSerialize(value) }
            case 'string': { return stringSerialize(value) }
            default: {
                if (value === null) { return nullSerialize }
                if (value instanceof Array) { return arraySerialize(value) }
                return objectSerialize(value)
            }
        }
    }
    const arraySerialize = compose(map(f))(arrayWrap)
    return f
}

/**
 * The standard `JSON.stringify` rules determined by
 * https://262.ecma-international.org/6.0/#sec-ordinary-object-internal-methods-and-internal-slots-ownpropertykeys
 *
 * @type {<T>(mapEntries: MapEntries<T>) => (value: Unknown<T>) => string}
 */

module.exports = {
    // /** @readonly */
    // setProperty,
    // /** @readonly */
    // stringify,
    // /** @readonly */
    // serialize,
    // /** @readonly */
    // parse,
    // /** @readonly */
    // isObject,
}
