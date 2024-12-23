import * as json from '../../../json/module.f.ts'
const { isObject } = json
import * as list from '../../../types/list/module.f.ts'
const { map, every } = list
const { entries } = Object

type DependencyJson = readonly[string, string]

type DependencyMapJson = {readonly[k in string]: string}

export type DependenciesJson = DependencyMapJson|null

const isDependencyJson
    : (entry: json.Entry) => boolean
    = ([, v]) => typeof v === 'string'

export const isDependenciesJson
    = (j: json.Unknown): j is DependenciesJson => {
    if (j === null) { return true }
    if (!isObject(j)) { return false }
    return every(map(isDependencyJson)(entries(j)))
}
