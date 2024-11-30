import json, * as jsonT from '../../json/module.f.mjs'
const { isObject } = json
import dependencies, * as dependenciesT from './dependencies/module.f.mjs'
const { isDependenciesJson } = dependencies
import o from '../../types/object/module.f.mjs'
const { at } = o

/**
 * @typedef {{
 *  readonly name: string
 *  readonly version: string
 *  readonly dependencies?: dependenciesT.DependenciesJson
 * }} PackageJson
 */

/** @type {(j: jsonT.Unknown) => j is PackageJson} */
const isPackageJson = j => {
    if (!isObject(j)) { return false }
    if (typeof j.name !== 'string') { return false }
    if (typeof j.version !== 'string') { return false }
    if (!isDependenciesJson(at('dependencies')(j))) { return false }
    return true
}

/**
 * @typedef {{
 *  readonly dependency: (localPackageId: string) => string | null
 *  readonly file: (localFileId: string) => string | null
 * }} Package
 */

/**
 * @note Current package has an empty string '' as a packageId.
 * @typedef {(packageId: string) => Package | null} Get
 */

export default {
    /** @readonly */
    dependencies,
    /** @readonly */
    isPackageJson,
}
