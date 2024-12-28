import { isObject, type Entry, type Unknown } from '../../../json/module.f.ts'
import { map, every } from '../../../types/list/module.f.ts'

const { entries } = Object

type DependencyJson = readonly[string, string]

type DependencyMapJson = {readonly[k in string]: string}

export type DependenciesJson = DependencyMapJson|null

const isDependencyJson = ([, v]: Entry) => typeof v === 'string'

export const isDependenciesJson = (j: Unknown): j is DependenciesJson => {
    if (j === null) { return true }
    if (!isObject(j)) { return false }
    return every(map(isDependencyJson)(entries(j)))
}
