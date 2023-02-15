const list = require('../types/list/module.f.cjs')
const { next, flat, reduce, map, empty } = list
const { concat } = require('../types/string/module.f.cjs')
const object = require('../types/object/module.f.cjs')
const { at } = object
const operator = require('../types/function/operator/module.f.cjs')
const { compose, fn } = require('../types/function/module.f.cjs')
const { entries } = Object
const { serialize: bigintSerialize } = require('../types/bigint/module.f.cjs')

/**
 * @typedef {{
 *  readonly [k in string]: Unknown
 * }} Object
 */

/** @typedef {readonly Unknown[]} Array */

/** @typedef {Object|boolean|string|number|null|Array|bigint} Unknown */

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

/** @typedef {object.Entry<Unknown>} Entry*/

/** @typedef {(list.List<Entry>)} Entries */

/** @typedef {(entries: Entries) => Entries} MapEntries */

/** @type {(mapEntries: MapEntries) => (value: Unknown) => list.List<string>} */
const serialize = sort => {
    /** @type {(kv: readonly[string, Unknown]) => list.List<string>} */
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
    /** @type {(value: Unknown) => list.List<string>} */
    const f = value => {
        switch (typeof value) {
            case 'boolean': { return boolSerialize(value) }
            case 'number': { return numberSerialize(value) }
            case 'string': { return stringSerialize(value) }
            case 'bigint': { return [bigintSerialize(value)] }
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
 * @type {(mapEntries: MapEntries) => (value: Unknown) => string}
 */
const stringify = sort => compose(serialize(sort))(concat)

module.exports = {

    /** @readonly */
    stringify,
    /** @readonly */
    serialize,
}