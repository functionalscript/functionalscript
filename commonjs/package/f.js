const json = require('../../json/f.js')
const dependencies = require('./dependencies/f.js')

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

/**
 * @note Current package has an empty string '' as a packageId.
 * @typedef {(packageId: string) => Package | undefined} Get
 */

module.exports = {
    /** @readonly */
    dependencies,
    /** @readonly */
    isPackageJson,
}
