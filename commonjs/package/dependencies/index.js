const json = require('../../../json/index.js')
const seq = require('../../../types/list/index.js')

/** @typedef {readonly[string, string]} DependencyJson */

/** @typedef {{readonly[k in string]: string}} DependencyMapJson */

/** @typedef {DependencyMapJson|undefined} DependenciesJson */

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
    isDependenciesJson,
}
