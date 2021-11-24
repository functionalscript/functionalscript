const seq = require('../sequence')
const map = require('../map')
const op = require('../sequence/operator')

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
    return path => f(seq.fromArray(path))
}

/** @type {(kv: readonly[string, seq.Sequence<string>]) => seq.Sequence<string>} */
const property = ([k, v]) => seq.concat(seq.list(JSON.stringify(k)), seq.list(':'), v)

/** @type {op.Scan<seq.Sequence<string>, seq.Sequence<string>>} */
const commaValue = a => [seq.concat(seq.list(','), a), commaValue]

/** @type {op.Scan<seq.Sequence<string>, seq.Sequence<string>>} */
const joinScan = value => [value, commaValue]

/** @type {seq.SequenceMap<seq.Sequence<string>, string>} */
const join = input => seq.flat(seq.scan(joinScan)(input))

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
    /** @type {map.Map<seq.Sequence<string>>} */
    const m = seq.fold(m => ([k, v]) => m.set(k)(stringSeq(v)))(map.empty)(seq.fromArray(Object.entries(object)))
    return objectList(seq.map(property)(m.entries))
}

/** @type {(array: Array) => seq.Sequence<string>} */
const arrayStringify = array => arrayList(seq.map(stringSeq)(seq.fromArray(array)))

/** @type {(value: Json) => seq.Sequence<string>} */
const stringSeq = value => {
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
const stringify = value => seq.join('')(stringSeq(value))

module.exports = {
    /** @readonly */
    addProperty,
    /** @readonly */
    stringify,
}