const json = require('../../../json/module.f.cjs')
const { isObject } = json
const list = require('../../../types/list/module.f.cjs')
const { map, every } = list
const { entries } = Object

/** @typedef {readonly[string, string]} DependencyJson */

/** @typedef {{readonly[k in string]: string}} DependencyMapJson */

/** @typedef {DependencyMapJson|null} DependenciesJson */

/** @type {(entry: json.Entry) => boolean} */
const isDependencyJson = ([, v]) => typeof v === 'string'

/** @type {(j: json.Unknown) => j is DependenciesJson} */
const isDependenciesJson = j => {
    if (j === null) { return true }
    if (!isObject(j)) { return false }
    return every(map(isDependencyJson)(entries(j)))
}

module.exports = {
    /** @readonly */
    isDependenciesJson,
}
