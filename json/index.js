const seq = require('../sequence')
const op = require('../sequence/operator')
const object = require('../object')
const array = require('../sequence/array')
const { compose } = require('../function')

/** 
 * @typedef {{
 *  readonly [k in string]: Json
 * }} Object 
 */

/** @typedef {readonly Json[]} Array */

/** @typedef {Object|boolean|string|number|null|Array} Json */

/** @type {(value: Json) => (path: seq.Sequence<string>) => (src: Json|undefined) => Json} */
const addProperty = value => {
    /** @type {(path: seq.Sequence<string>) => (src: Json|undefined) => Json} */
    const f = path => src => {
        const result = seq.next(path)
        if (result === undefined) { return value }
        const srcObject = (src === undefined || src === null || typeof src !== 'object' || src instanceof Array) ? {} : src
        const { first, tail } = result
        return { ...srcObject, [first]: f(tail)(object.at(first)(srcObject)) }
    }    
    return f
}

/** @type {(_: string) => seq.Sequence<string>} */
const stringSerialize = input => [JSON.stringify(input)]

/** @type {(_: number) => seq.Sequence<string>} */
const numberSerialize = input => [JSON.stringify(input)]

const nullSerialize = ['null']

const trueSerialize = ['true']

const falseSerialize = ['false']

/** @type {(_: boolean) => seq.Sequence<string>} */
const boolSerialize = value => value ? trueSerialize : falseSerialize

const colon = [':']
const comma = [',']

/** @type {op.Scan<seq.Sequence<string>, seq.Sequence<string>>} */
const commaValue = a => [seq.concat(comma, a), commaValue]

/** @type {seq.FoldOperator<seq.Sequence<string>>} */
const joinOp = a => b => seq.concat(a, comma, b)

/** @type {(input: seq.Sequence<seq.Sequence<string>>) => seq.Sequence<string>} */
const join = seq.fold(joinOp)([])

/** @type {(open: string) => (close: string) => (input: seq.Sequence<seq.Sequence<string>>) => seq.Sequence<string>} */
const list = open => close => {
    const seqOpen = [open]
    const seqClose = [close]
    return input => seq.concat(seqOpen, join(input), seqClose)
}

const objectList = list('{')('}')

const arrayList = list('[')(']')

/** @typedef {object.Entry<Json>} Entry*/

/** @typedef {(seq.Sequence<Entry>)} Entries */

/** @typedef {(entries: Entries) => Entries} MapEntries */

/** @type {(mapEntries: MapEntries) => (value: Json) => seq.Sequence<string>} */
const serialize = sort => {
    /** @type {(kv: readonly[string, Json]) => seq.Sequence<string>} */
    const propertySerialize = ([k, v]) => seq.concat(
        stringSerialize(k),
        colon,
        f(v))
    /** @type {(object: Object) => seq.Sequence<string>} */
    const objectSerialize = input => {
        const entries = Object.entries(input)
        const sortedEntries = sort(entries)
        const _ = seq.toArray(sortedEntries)
        const serializedEntries = seq.map(propertySerialize)(sortedEntries)
        return objectList(serializedEntries)
    }
    /** @type {(input: Array) => seq.Sequence<string>} */
    const arraySerialize = input => {
        const serializedEntries = seq.map(f)(input)
        return arrayList(serializedEntries)
    }
    /** @type {(value: Json) => seq.Sequence < string >} */
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
    return f
}

/**
 * A version of `JSON.stringify` with an alphabeticly ordered `keys`.
 * 
 * The standard `JSON.stringify` rules determines by 
 * https://262.ecma-international.org/6.0/#sec-ordinary-object-internal-methods-and-internal-slots-ownpropertykeys
 *  
 * @type {(mapEntries: MapEntries) => (value: Json) => string}
 */
const stringify = sort => value => {
    const _s = serialize(sort)(value)
    return seq.join('')(_s)
}

/** @type {(value: string) => Json} */
const parse = value => JSON.parse(value)

module.exports = {
    /** @readonly */
    addProperty,
    /** @readonly */
    stringify,
    /** @readonly */
    serialize,
    /** @readonly */
    parse,
}