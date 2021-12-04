const json = require('../../../json')
const { isObject } = json
const seq = require('../../../types/sequence')

/** @typedef {readonly[string, string]} Dependency */

/**
 * @typedef {{
 *  readonly [k in string]: string
 * } | undefined} Dependencies
 */

/** @type {(entry: json.Entry) => boolean} */
const isDependency = ([, v]) => typeof v === 'string'

/** @type {(j: json.Unknown|undefined) => j is Dependencies} */
const isDependencies = j => {
    if (j === undefined) { return true }
    if (!json.isObject(j)) { return false }
    return seq.every(seq.map(isDependency)(Object.entries(j)))
}

module.exports = {
    /** @readonly */
    isDependencies,
}