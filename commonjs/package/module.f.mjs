import json from '../../json/module.f.cjs'
const { isObject } = json
import dependencies, * as dependenciesT from './dependencies/module.f.mjs'
const { isDependenciesJson } = dependencies
import { at } from '../../types/object/module.f.cjs'

/**
 * @typedef {{
 *  readonly name: string
 *  readonly version: string
 *  readonly dependencies?: dependenciesT.DependenciesJson
 * }} PackageJson
 */

/** @type {(j: json.Unknown) => j is PackageJson} */
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