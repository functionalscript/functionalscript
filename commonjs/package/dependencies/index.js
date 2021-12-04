const json = require('../../../json')
const { isObject } = json
const seq = require('../../../types/sequence')

/** @typedef {readonly[string, string]} DependencyJson */

/**
 * @typedef {{
 *  readonly [k in string]: string
 * } | undefined} DependenciesJson
 */

/** @type {(entry: json.Entry) => boolean} */
const isDependencyJson = ([, v]) => typeof v === 'string'

/** @type {(j: json.Unknown|undefined) => j is DependenciesJson} */
const isDependenciesJson = j => {
    if (j === undefined) { return true }
    if (!json.isObject(j)) { return false }
    return seq.every(seq.map(isDependencyJson)(Object.entries(j)))
}

module.exports = {
    /** @readonly */
    isDependenciesJson: isDependenciesJson,
}