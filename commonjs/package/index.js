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

/**
 * @typedef {{
 *  readonly dependency: (localPackageId: string) => string | undefined
 *  readonly file: (localFileId: string) => string | undefined
 * }} Package
 */

/** @typedef {(packageId: string) => Package | undefined} PackageGet */

module.exports = {
    /** @readonly */
    isPackageJson,
}
