const json = require('../../../json')
const { isObject } = json
const seq = require('../../../types/sequence')
const { split } = require('../../path')
const map = require('../../../types/map')

/** @typedef {(directoryName: string) => undefined|string|Directory} Directory */

const empty = () => undefined

/** 
 * @typedef {{
 *  readonly get: (dir: string) => Item|undefined
 *  readonly set: (dir: string) => (item: Item) => Map
 * }} Map
 */

/** @typedef {Map|string} Item */

/** @typedef {readonly[string, Map]} Pair */

/** @type {(prior: seq.Sequence<Pair>) => (dir: string) => seq.Sequence<Pair>} */
const get = prior => dir => {
    const result = seq.next(prior)
    if (result === undefined) { throw 'panic' }
    const { first: [,m] } = result
    const child = m.get(dir)
    const childMap = child === undefined || typeof child === 'string' ? map.empty : child
    /** @type {Pair} */
    const pair = [dir, childMap]
    return seq.sequence(pair)(prior)
}

/** @typedef {readonly[string, Item]} Result */

/** @type {(a: Result) => (b: Pair) => Result} */
const set = ([aDir, item]) => ([bDir, bMap]) => [bDir, bMap.set(aDir)(item)]

/** @type {(prior: Map) => (entry: json.Entry) => Map} */
const addDirectory = prior => ([directory, id]) => {
    if (typeof id !== 'string') { return prior }
    const path = split(directory)
    const rev = seq.reduce(get)([['', prior]])(path)
    const result = seq.next(rev)
    if (result === undefined) { throw 'panic' }
    const { first: [dir], tail } = result
    const [, m] = seq.reduce(set)([dir, id])(tail)
    if (typeof m === 'string') { return prior }
    return m
}

/** @type {(m: Map) => Directory} */
const func = m => dir => {
    const r = m.get(dir)
    if (typeof r !== 'object') { return r }
    return func(r)
}

/** @type {(packageJson: json.Unknown) => Directory} */
const getDirectory = packageJson => {
    if (!isObject(packageJson)) { return empty }
    const dep = packageJson['dependencies']
    if (dep === undefined || !isObject(dep)) { return empty }
    const result = seq.reduce(addDirectory)(map.empty)(Object.entries(dep))
    return func(result)
}

module.exports = {
    /** @readonly */
    getDirectory,
}