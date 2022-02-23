const seq = require('../types/list/index.js')
const object = require('../types/object/index.js')
const op = require('../types/function/operator/index.js')
const { compose } = require('../types/function/index.js')

/**
 * @typedef {{
 *  readonly [k in string]: Unknown
 * }} Object
 */

/** @typedef {readonly Unknown[]} Array */

/** @typedef {Object|boolean|string|number|null|Array} Unknown */

/** @type {(value: Unknown) => (path: seq.List<string>) => (src: Unknown|undefined) => Unknown} */
const setProperty = value => {
    /** @type {(path: seq.List<string>) => (src: Unknown|undefined) => Unknown} */
    const f = path => src => {
        const result = seq.next(path)
        if (result === undefined) { return value }
        const srcObject = (src === undefined || src === null || typeof src !== 'object' || src instanceof Array) ? {} : src
        const { first, tail } = result
        return { ...srcObject, [first]: f(tail)(object.at(first)(srcObject)) }
    }
    return f
}

/** @type {(_: string) => seq.List<string>} */
const stringSerialize = input => [JSON.stringify(input)]

/** @type {(_: number) => seq.List<string>} */
const numberSerialize = input => [JSON.stringify(input)]

const nullSerialize = ['null']

const trueSerialize = ['true']

const falseSerialize = ['false']

/** @type {(_: boolean) => seq.List<string>} */
const boolSerialize = value => value ? trueSerialize : falseSerialize

const colon = [':']
const comma = [',']

/** @type {op.Fold<seq.List<string>>} */
const joinOp = b => prior => seq.flat([prior, comma, b])

/** @type {(input: seq.List<seq.List<string>>) => seq.List<string>} */
const join = seq.fold(joinOp)([])

/** @type {(open: string) => (close: string) => (input: seq.List<seq.List<string>>) => seq.List<string>} */
const list = open => close => {
    const seqOpen = [open]
    const seqClose = [close]
    return input => seq.flat([seqOpen, join(input), seqClose])
}

const objectList = list('{')('}')

const arrayList = list('[')(']')

/** @typedef {object.Entry<Unknown>} Entry*/

/** @typedef {(seq.List<Entry>)} Entries */

/** @typedef {(entries: Entries) => Entries} MapEntries */

/** @type {(mapEntries: MapEntries) => (value: Unknown) => seq.List<string>} */
const serialize = sort => {
    /** @type {(kv: readonly[string, Unknown]) => seq.List<string>} */
    const propertySerialize = ([k, v]) => seq.flat([
        stringSerialize(k),
        colon,
        f(v)
    ])
    /** @type {(object: Object) => seq.List<string>} */
    const objectSerialize = input => objectList(seq.map(propertySerialize)(sort(Object.entries(input))))
    /** @type {(value: Unknown) => seq.List<string>} */
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
    /** @type {(input: Array) => seq.List<string>} */
    const arraySerialize = compose(seq.map(f))(arrayList)
    return f
}

/**
 * The standard `JSON.stringify` rules determined by
 * https://262.ecma-international.org/6.0/#sec-ordinary-object-internal-methods-and-internal-slots-ownpropertykeys
 *
 * @type {(mapEntries: MapEntries) => (value: Unknown) => string}
 */
const stringify = sort => compose(serialize(sort))(seq.join(''))

/** @type {(value: string) => Unknown} */
const parse = JSON.parse

/** @type {(value: Unknown) => value is Object} */
const isObject = value => typeof value === 'object' && value !== null && !(value instanceof Array)

module.exports = {
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
