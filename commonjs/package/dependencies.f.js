const json = require('../../json/f.js')
const list = require('../../types/list/index.f.js')

/** @typedef {readonly[string, string]} DependencyJson */

/** @typedef {{readonly[k in string]: string}} DependencyMapJson */

/** @typedef {DependencyMapJson|undefined} DependenciesJson */

/** @type {(entry: json.Entry) => boolean} */
const isDependencyJson = ([, v]) => typeof v === 'string'

/** @type {(j: json.Unknown|undefined) => j is DependenciesJson} */
const isDependenciesJson = j => {
    if (j === undefined) { return true }
    if (!json.isObject(j)) { return false }
    return list.every(list.map(isDependencyJson)(Object.entries(j)))
}

module.exports = {
    /** @readonly */
    isDependenciesJson,
}
