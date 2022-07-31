const list = require('../types/list/module.f.cjs')
const object = require('../types/object/module.f.cjs')
const operator = require('../types/function/operator/module.f.cjs')
const { compose } = require('../types/function/module.f.cjs')

/**
 * @typedef {{
 *  readonly [k in string]: Unknown
 * }} Object
 */

/** @typedef {readonly Unknown[]} Array */

/** @typedef {Object|boolean|string|number|null|Array} Unknown */

/** @type {(value: Unknown) => (path: list.List<string>) => (src: Unknown|undefined) => Unknown} */
const setProperty = value => {
    /** @type {(path: list.List<string>) => (src: Unknown|undefined) => Unknown} */
    const f = path => src => {
        const result = list.next(path)
        if (result === undefined) { return value }
        const srcObject = (src === undefined || src === null || typeof src !== 'object' || src instanceof Array) ? {} : src
        const { first, tail } = result
        return { ...srcObject, [first]: f(tail)(object.at(first)(srcObject)) }
    }
    return f
}

/** @type {(_: string) => list.List<string>} */
const stringSerialize = input => [JSON.stringify(input)]

/** @type {(_: number) => list.List<string>} */
const numberSerialize = input => [JSON.stringify(input)]

const nullSerialize = ['null']

const trueSerialize = ['true']

const falseSerialize = ['false']

/** @type {(_: boolean) => list.List<string>} */
const boolSerialize = value => value ? trueSerialize : falseSerialize

const colon = [':']
const comma = [',']

/** @type {operator.Fold<list.List<string>>} */
const joinOp = b => prior => list.flat([prior, comma, b])

/** @type {(input: list.List<list.List<string>>) => list.List<string>} */
const join = list.fold(joinOp)([])

/** @type {(open: string) => (close: string) => (input: list.List<list.List<string>>) => list.List<string>} */
const wrap = open => close => {
    const seqOpen = [open]
    const seqClose = [close]
    return input => list.flat([seqOpen, join(input), seqClose])
}

const objectWrap = wrap('{')('}')

const arrayWrap = wrap('[')(']')

/** @typedef {object.Entry<Unknown>} Entry*/

/** @typedef {(list.List<Entry>)} Entries */

/** @typedef {(entries: Entries) => Entries} MapEntries */

/** @type {(mapEntries: MapEntries) => (value: Unknown) => list.List<string>} */
const serialize = sort => {
    /** @type {(kv: readonly[string, Unknown]) => list.List<string>} */
    const propertySerialize = ([k, v]) => list.flat([
        stringSerialize(k),
        colon,
        f(v)
    ])
    /** @type {(object: Object) => list.List<string>} */
    const objectSerialize = input => objectWrap(list.map(propertySerialize)(sort(Object.entries(input))))
    /** @type {(value: Unknown) => list.List<string>} */
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
    /** @type {(input: Array) => list.List<string>} */
    const arraySerialize = compose(list.map(f))(arrayWrap)
    return f
}

/**
 * The standard `JSON.stringify` rules determined by
 * https://262.ecma-international.org/6.0/#sec-ordinary-object-internal-methods-and-internal-slots-ownpropertykeys
 *
 * @type {(mapEntries: MapEntries) => (value: Unknown) => string}
 */
const stringify = sort => compose(serialize(sort))(list.join(''))

/** @type {(value: string) => Unknown} */
const parse = JSON.parse

/** @type {(value: Unknown) => value is Object} */
const isObject = value => typeof value === 'object' && value !== null && !(value instanceof Array)

module.exports = {
    /** @readonly */
    tokenizer: require('./tokenizer/module.f.cjs'),
    /** @readonly */
    setProperty,
    /** @readonly */
    stringify,
    /** @readonly */
    serialize,
    /** @readonly */
    parse,
    /** @readonly */
    isObject,
}
