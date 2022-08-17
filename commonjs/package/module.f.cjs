const json = require('../../json/module.f.cjs')
const { isObject } = json
const dependencies = require('./dependencies/module.f.cjs')
const { isDependenciesJson } = dependencies

/**
 * @typedef {{
 *  readonly name: string
 *  readonly version: string
 *  readonly dependencies?: dependencies.DependenciesJson
 * }} PackageJson
 */

/** @type {(j: json.Unknown) => j is PackageJson} */
const isPackageJson = j => {
    if (!isObject(j)) { return false }
    if (typeof j.name !== 'string') { return false }
    if (typeof j.version !== 'string') { return false }
    if (!isDependenciesJson(j.dependencies)) { return false }
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
