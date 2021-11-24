const seq = require('../sequence')
const map = require('../map')
const op = require('../sequence/operator')
const option = require('../option')
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
        return { ...srcObject, [name]: f(tail)(srcObject[name]) }
    }
    return path => f(array.sequence(path))
}

/** @type {(kv: readonly[string, Json]) => seq.Sequence<string>} */
const property = ([k, v]) => seq.concat(
    seq.list(JSON.stringify(k)), 
    seq.list(':'), 
    stringSequence(v))

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

/** @type {(object: Object) => seq.Sequence<string>} */
const objectStringify = object => {
    const _0 = Object.entries(object)
    const _1 = array.sequence(_0)
    const _2 = map.fromEntries(_1)
    const _3 = _2.entries
    const _4 = seq.map(property)(_3)
    return objectList(_4)
}

/** @type {(input: Array) => seq.Sequence<string>} */
const arrayStringify = input => {
    const _0 = array.sequence(input)
    const _1 = seq.map(stringSequence)(_0)
    return arrayList(_1)
}

/** @type {(value: Json) => seq.Sequence<string>} */
const stringSequence = value => {
    const x = typeof value
    switch (typeof value) {
        case 'boolean': { return seq.list(value ? "true" : "false") }
        // Note: we shouldn't use JSON.stringify since it has non determenistic behavior.
        // In particular: property order could be different.
        case 'number': case 'string': { return seq.list(JSON.stringify(value)) }
        default: {
            if (value === null) { return seq.list("null") }
            if (value instanceof Array) { return arrayStringify(value) }
            return objectStringify(value)
        }
    }
}

/**
 * A deterministic version of `JSON.stringify`
 *  
 * @type {(value: Json) => string} 
 */
const stringify = value => seq.join('')(stringSequence(value))

module.exports = {
    /** @readonly */
    addProperty,
    /** @readonly */
    stringify,
}