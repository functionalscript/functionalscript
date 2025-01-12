import * as list from '../../types/list/module.f.ts'
const { flat, map, entries: listEntries, concat: listConcat, flatMap } = list
import * as string from '../../types/string/module.f.ts'
const { concat } = string
import type * as O from '../../types/object/module.f.ts'
import * as f from '../../types/function/module.f.ts'
const { compose, fn } = f
const { entries } = Object
import * as bi from '../../types/bigint/module.f.ts'
const { serialize: bigintSerialize } = bi
import * as j from '../../json/serializer/module.f.ts'
import type { DjsConst, DjsModule, DjsObject } from '../shared/module.f'
const { objectWrap, arrayWrap, stringSerialize, numberSerialize, nullSerialize, boolSerialize } = j
import { type Result, error } from '../../types/result/module.f.ts'
import { setReplace, at, type Map } from '../../types/map/module.f.ts'

const colon = [':']

export const undefinedSerialize = ['undefined']

type Entry = O.Entry<DjsConst>

type Entries = list.List<Entry>

type MapEntries = (entries: Entries) => Entries

const djsConstSerialize
: (mapEntries: MapEntries) => (value: DjsConst) => list.List<string>
= sort => {
    const propertySerialize
    : (kv: readonly[string, DjsConst]) => list.List<string>
    = ([k, v]) => flat([
        stringSerialize(k),
        colon,
        f(v)
    ])
    const mapPropertySerialize = map(propertySerialize)
    const objectSerialize
    : (object: DjsObject) => list.List<string>
    = fn(entries)
        .then(sort)
        .then(mapPropertySerialize)
        .then(objectWrap)
        .result
    const f
    : (value: DjsConst) => list.List<string>
    = value => {
        switch (typeof value) {
            case 'boolean': { return boolSerialize(value) }
            case 'number': { return numberSerialize(value) }
            case 'string': { return stringSerialize(value) }
            case 'bigint': { return [bigintSerialize(value)] }
            default: {
                if (value === null) { return nullSerialize }
                if (value === undefined) { return undefinedSerialize }
                if (value instanceof Array) {
                    switch (value[0]) {
                        case 'aref': { return [`a${value[1]}`] }
                        case 'cref': { return [`c${value[1]}`] }
                        case 'array': { return arraySerialize(value[1]) }
                    }
                }
                return objectSerialize(value)
            }
        }
    }
    const arraySerialize = compose(map(f))(arrayWrap)
    return f
}

export const djsModuleStringify
: (sort: MapEntries) => (djsModule: DjsModule) => string
= sort => djsModule => {
    const importEntries = listEntries(djsModule[0])
    const importSerialize
    : (entry: list.Entry<string>) => list.List<string>
    = entry => flat([['import a'], numberSerialize(entry[0]), [' from "', entry[1], '"\n']])

    const len = djsModule[1].length
    const constEntries = listEntries(djsModule[1])
    const moduleEntrySerialize
    : (entry: list.Entry<DjsConst>) => list.List<string>
    = entry => {
        if (entry[0] === len - 1) {
            return listConcat(['export default '])(djsConstSerialize(sort)(entry[1]))
        }
        return flat([['const c'], numberSerialize(entry[0]), [' = '], djsConstSerialize(sort)(entry[1]), ['\n']])
    }

    return concat(listConcat(flatMap(importSerialize)(importEntries))(flatMap(moduleEntrySerialize)(constEntries)))
}


export const serializeModules: (root: string) => (sort: MapEntries) => (modules: Map<DjsModule>) => Result<string, string>
= root => sort => modules => {    
    return error('error')
}

