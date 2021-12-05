const json = require('../../json')
const dep = require('./dependencies')
const object = require('../../types/object')
const run = require('../run')

/** 
 * @typedef {{
 *  readonly name: string
 *  readonly version: string
 *  readonly dependencies?: dep.DependenciesJson
 * }} PackageJson 
 */

/** @type {(j: json.Unknown) => j is PackageJson} */
const isPackageJson = j => {
    if (!json.isObject(j)) { return false }
    if (typeof j.name !== 'string') { return false }
    if (typeof j.version !== 'string') { return false }
    if (!dep.isDependenciesJson(j.dependencies)) { return false }
    return true
}

/** @typedef {object.Map<string>} Files */

/** @typedef {object.Map<dep.DependencyJson>} PackageMap */

module.exports = {
    /** @readonly */
    isPackageJson,
}
