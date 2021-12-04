const json = require('../../json')
const seq = require('../../types/sequence')

/** 
 * @typedef {{
 *  readonly version: string
 *  readonly dependencies?: Dependencies
 * }} Package 
 */

/** @type {(j: json.Unknown) => j is Package} */
const isPackage = j => {
    if (!json.isObject(j)) { return false }
    if (typeof j.version !== 'string') { return false }
    if (j.dependencies !== undefined && !isDependencies(j.dependencies)) { return false }
    return true
}

/**
 * @typedef {{
 *  readonly [k in string]: string
 * }} Dependencies
 */

/** @type {(entry: json.Entry) => boolean} */
const isDependency = ([,v]) => typeof v === 'string'

/** @type {(j: json.Unknown) => j is Dependencies} */
const isDependencies = j => {
    if (!json.isObject(j)) { return false }
    return seq.every(seq.map(isDependency)(Object.entries(j)))
}

module.exports = {
    /** @readonly */
    isPackage,
}