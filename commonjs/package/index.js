const json = require('../../json')
const dependencies = require('./dependencies')

/** 
 * @typedef {{
 *  readonly name: string
 *  readonly version: string
 *  readonly dependencies?: dependencies.DependenciesJson
 * }} PackageJson 
 */

/** @type {(j: json.Unknown) => j is PackageJson} */
const isPackageJson = j => {
    if (!json.isObject(j)) { return false }
    if (typeof j.name !== 'string') { return false }
    if (typeof j.version !== 'string') { return false }
    if (!dependencies.isDependenciesJson(j.dependencies)) { return false }
    return true
}

/**
 * @typedef {{
 *  readonly dependency: (localPackageId: string) => string | undefined
 *  readonly file: (localFileId: string) => string | undefined
 * }} Package
 */

/** @typedef {(packageId: string) => Package | undefined} Get */

module.exports = {
    /** @readonly */
    isPackageJson,
}
