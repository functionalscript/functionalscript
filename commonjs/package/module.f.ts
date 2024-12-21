import * as json from '../../json/module.f.mjs'
const { isObject } = json
import * as dependencies from './dependencies/module.f.ts'
const { isDependenciesJson } = dependencies
import * as o from '../../types/object/module.f.mjs'
const { at } = o

type PackageJson = {
    readonly name: string
    readonly version: string
    readonly dependencies?: dependencies.DependenciesJson
}

export const isPackageJson
    = (j: json.Unknown): j is PackageJson => {
    if (!isObject(j)) { return false }
    if (typeof j.name !== 'string') { return false }
    if (typeof j.version !== 'string') { return false }
    if (!isDependenciesJson(at('dependencies')(j))) { return false }
    return true
}

export type Package = {
    readonly dependency: (localPackageId: string) => string | null
    readonly file: (localFileId: string) => string | null
 }

/**
 * @note Current package has an empty string '' as a packageId.
 */
export type Get = (packageId: string) => Package | null
