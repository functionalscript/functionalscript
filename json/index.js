const seq = require('../sequence')
const map = require('../map')
const op = require('../sequence/operator')
const object = require('../object')
const array = require('../sequence/array')

/** 
 * @typedef {{
 *  readonly [k in string]: Json
 * }} Object 
 */

/** @typedef {readonly Json[]} Array */

/** @typedef {Object|boolean|string|number|null|Array} Json */

/** @type {(value: Json) => (path: readonly string[]) => (src: Json|undefined) => Json} */
const addProperty = value => {
    /** @type {(path: seq.Sequence<string>) => (src: Json|undefined) => Json} */
    const f = path => src => {
        const result = seq.next(path)
        if (result === undefined) { return value }
        const srcObject = (src === undefined || src === null || typeof src !== 'object' || src instanceof Array) ? {} : src
        const [name, tail] = result
        return { ...srcObject, [name]: f(tail)(object.at(name)(srcObject)) }
    }
    return path => f(array.sequence(path))
}

/** @type {(_: string) => seq.Sequence<string>} */
const stringSerialize = input => seq.list(JSON.stringify(input))

/** @type {(_: number) => seq.Sequence<string>} */
const numberSerialize = input => seq.list(JSON.stringify(input))

const nullSerialize = seq.list('null')

const trueSerialize = seq.list('true')

const falseSerialize = seq.list('false')

/** @type {(_: boolean) => seq.Sequence<string>} */
const boolSerialize = value => value ? trueSerialize : falseSerialize

const colon = seq.list(':')
const comma = seq.list(',')

/** @type {op.Scan<seq.Sequence<string>, seq.Sequence<string>>} */
const commaValue = a => [seq.concat(comma, a), commaValue]

/** @type {op.Scan<seq.Sequence<string>, seq.Sequence<string>>} */
const joinScan = value => [value, commaValue]

/** @type {seq.SequenceMap<seq.Sequence<string>, string>} */
const join = input => {
    const _0 = seq.scan(joinScan)(input)
    return seq.flat(_0)
}

/** @type {(open: string) => (close: string) => (input: seq.Sequence<seq.Sequence<string>>) => seq.Sequence<string>} */
const list = open => close => {
    const seqOpen = seq.list(open)
    const seqClose = seq.list(close)
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
        const entries = object.entries(input)
        const sortedEntries = sort(entries)
        const serializedEntries = seq.map(propertySerialize)(sortedEntries)
        return objectList(serializedEntries)
    }
    /** @type {(input: Array) => seq.Sequence<string>} */
    const arraySerialize = input => {
        const sequence = array.sequence(input)
        const serializedEntries = seq.map(f)(sequence)
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
const stringify = sort => value => seq.join('')(serialize(sort)(value))

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