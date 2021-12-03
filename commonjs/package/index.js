const { todo } = require('../../dev')
const json = require('../../json')
const { isObject } = json
const seq = require('../../types/sequence')
const { split } = require('../path')
const map = require('../../types/map')

/** @typedef {(directoryName: string) => undefined|string|Directory} Directory */

const empty = () => undefined

/** 
 * @typedef {{
 *  readonly get: (dir: string) => Item|undefined
 *  readonly set: (dir: string) => (item: Item) => Map
 * }} Map
 */

/** @typedef {Map|string} Item */

/** @type {(prior: seq.Sequence<Map>) => (item: string) => seq.Sequence<Map>} */
const get = prior => item => {
    const result = seq.next(prior)
    if (result === undefined) { throw 'panic' }
    const { first } = result
    const child = first.get(item)
    const childMap = child === undefined || typeof child === 'string' ? map.empty : child
    return seq.sequence(childMap)(prior)
}

/** @type {(prior: Map) => (entry: json.Entry) => Map} */
const addDirectory = prior => ([directory, id]) => {
    if (typeof id !== 'string') { return prior }
    const path = split(directory)
    const maps = seq.drop(1)(seq.reduce(get)([prior])(path))
    return prior
}

/** @type {(packageJson: json.Unknown) => Directory} */
const dependencies = packageJson => {
    if (!isObject(packageJson)) { return empty }
    const dependencies = packageJson['dependencies']
    if (dependencies === undefined || !isObject(dependencies)) { return empty }
    const result = seq.reduce(addDirectory)(map.empty)
    return todo()
}

module.exports = {
    /** @readonly */
    dependencies,
}