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
const property = ([k, v]) => {
    let r = seq.one(JSON.stringify(k))
    r = seq.concat2(r)(seq.one(':'))
    return seq.concat2(r)(v)
}

/** @type {op.Scan<seq.Sequence<string>, seq.Sequence<string>>} */
const commaValue = a => [seq.concat2(seq.one(','))(a), commaValue]

/** @type {op.Scan<seq.Sequence<string>, seq.Sequence<string>>} */
const joinScan = value => [value, commaValue]

/** @type {seq.SequenceMap<seq.Sequence<string>, seq.Sequence<string>>} */
const join = seq.scan(joinScan)

/** @type {(object: Object) => seq.Sequence<string>} */
const objectStringify = object => {
    /** @type {map.Map<seq.Sequence<string>>} */
    let m = map.empty
    for (const [k, v] of Object.entries(object)) {
        m = m.set(k)(stringSeq(v))
    }
    const properties = join(seq.map(property)(m.entries))
    const result = seq.concat2(seq.one('{'))(seq.flat(properties))
    return seq.concat2(result)(seq.one('}'))
}

/** @type {(array: Array) => seq.Sequence<string>} */
const arrayStringify = array => {
    let a = seq.flat(join(seq.map(stringSeq)(seq.fromArray(array))))
    const s = seq.concat2(seq.one('['))(a)    
    return seq.concat2(s)(seq.one(']'))
}

/** @type {(value: Json) => seq.Sequence<string>} */
const stringSeq = value => {
    const x = typeof value
    switch (typeof value) {
        case 'boolean': { return seq.one(value ? "true" : "false") }
        // Note: we shouldn't use JSON.stringify since it has non determenistic behavior.
        // In particular: property order could be different.
        case 'number': case 'string': { return seq.one(JSON.stringify(value)) }
        default: {
            if (value === null) { return seq.one("null") }
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