// @ts-self-types="./module.f.d.mts"
import * as json from '../../json/module.f.mjs'
const { isObject } = json
import * as dependencies from './dependencies/module.f.mjs'
const { isDependenciesJson } = dependencies
import * as o from '../../types/object/module.f.mjs'
const { at } = o

/**
 * @typedef {{
 *  readonly name: string
 *  readonly version: string
 *  readonly dependencies?: dependencies.DependenciesJson
 * }} PackageJson
 */

/** @type {(j: json.Unknown) => j is PackageJson} */
export const isPackageJson = j => {
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
