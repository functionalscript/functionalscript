// @ts-self-types="./module.f.d.mts"

import * as list from '../../types/list/module.f.mjs'
const { flat, map, entries: listEntries, concat: listConcat, flatMap } = list
import * as string from '../../types/string/module.f.mjs'
const { concat } = string
import * as O from '../../types/object/module.f.mjs'
import * as f from '../../types/function/module.f.mjs'
const { compose, fn } = f
const { entries } = Object
import * as bi from '../../types/bigint/module.f.mjs'
const { serialize: bigintSerialize } = bi
import * as j from '../../json/serializer/module.f.mjs'
const { objectWrap, arrayWrap, stringSerialize, numberSerialize, nullSerialize, boolSerialize } = j
import * as DjsParser from '../parser/module.f.mjs'

const colon = [':']

export const undefinedSerialize = ['undefined']

/** @typedef {O.Entry<DjsParser.DjsConst>} Entry*/

/** @typedef {(list.List<Entry>)} Entries */

/** @typedef {(entries: Entries) => Entries} MapEntries */

/** @type {(mapEntries: MapEntries) => (value: DjsParser.DjsConst) => list.List<string>} */
const djsConstSerialize = sort => {
    /** @type {(kv: readonly[string, DjsParser.DjsConst]) => list.List<string>} */
    const propertySerialize = ([k, v]) => flat([
        stringSerialize(k),
        colon,
        f(v)
    ])    
    const mapPropertySerialize = map(propertySerialize)
    /** @type {(object: DjsParser.DjsObject) => list.List<string>} */
    const objectSerialize = fn(entries)
        .then(sort)
        .then(mapPropertySerialize)
        .then(objectWrap)
        .result
    /** @type {(value: DjsParser.DjsConst) => list.List<string>} */
    const f = value => {
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

/** @type {(mapEntries: MapEntries) => (djsModule: DjsParser.DjsModule) => string} */
export const djsModuleStringify =  sort => djsModule => {
    const importEntries = listEntries(djsModule[0])
    /** @type {(entry: list.Entry<string>) => list.List<string>} */
    const importSerialize = entry => flat([['import a'], numberSerialize(entry[0]), [' from "', entry[1], '"\n']])

    const len = djsModule[1].length
    const constEntries = listEntries(djsModule[1])
    /** @type {(entry: list.Entry<DjsParser.DjsConst>) => list.List<string>} */
    const moduleEntrySerialize = entry => {
        if (entry[0] === len - 1) {
            return listConcat(['export default '])(djsConstSerialize(sort)(entry[1]))
        }
        return flat([['const c'], numberSerialize(entry[0]), [' = '], djsConstSerialize(sort)(entry[1]), ['\n']])
    }

    return concat(listConcat(flatMap(importSerialize)(importEntries))(flatMap(moduleEntrySerialize)(constEntries)))
}

