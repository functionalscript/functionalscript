const json = require('../../json')
const dep = require('./dependencies')

/** 
 * @typedef {{
 *  readonly version: string
 *  readonly dependencies?: dep.DependenciesJson
 * }} PackageJson 
 */

/** @type {(j: json.Unknown) => j is PackageJson} */
const isPackageJson = j => {
    if (!json.isObject(j)) { return false }
    if (typeof j.version !== 'string') { return false }
    if (!dep.isDependenciesJson(j.dependencies)) { return false }
    return true
}

module.exports = {
    /** @readonly */
    isPackageJson,
}
