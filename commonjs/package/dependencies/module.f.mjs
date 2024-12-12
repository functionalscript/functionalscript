// @ts-self-types="./module.f.d.mts"
import * as json from '../../../json/module.f.mjs'
const { isObject } = json
import * as list from '../../../types/list/module.f.mjs'
const { map, every } = list
const { entries } = Object

/** @typedef {readonly[string, string]} DependencyJson */

/** @typedef {{readonly[k in string]: string}} DependencyMapJson */

/** @typedef {DependencyMapJson|null} DependenciesJson */

/** @type {(entry: json.Entry) => boolean} */
const isDependencyJson = ([, v]) => typeof v === 'string'

/** @type {(j: json.Unknown) => j is DependenciesJson} */
export const isDependenciesJson = j => {
    if (j === null) { return true }
    if (!isObject(j)) { return false }
    return every(map(isDependencyJson)(entries(j)))
}
