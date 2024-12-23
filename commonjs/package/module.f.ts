import { isObject, type Unknown } from '../../json/module.f.ts'
import { isDependenciesJson, type DependenciesJson } from './dependencies/module.f.ts'
import { at } from '../../types/object/module.f.ts'

type PackageJson = {
    readonly name: string
    readonly version: string
    readonly dependencies?: DependenciesJson
}

export const isPackageJson
= (j: Unknown): j is PackageJson => {
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
